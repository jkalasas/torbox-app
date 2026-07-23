use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::watch;

use crate::bandwidth_limiter::BandwidthLimiter;
use crate::persistence::Persistence;

const CHUNK_SIZE: u64 = 4 * 1024 * 1024; // 4MB
const MAX_CHUNK_RETRIES: u32 = 3;
const MAX_FULL_RETRIES: u32 = 8;
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(250);

pub struct ChunkedDownloader {
    persistence: Arc<Persistence>,
    limiter: Arc<BandwidthLimiter>,
    client: reqwest::Client,
}

impl ChunkedDownloader {
    pub fn new(
        persistence: Arc<Persistence>,
        limiter: Arc<BandwidthLimiter>,
        client: reqwest::Client,
    ) -> Self {
        Self {
            persistence,
            limiter,
            client,
        }
    }

    pub fn compute_chunks(file_size: u64) -> Vec<(u32, u64, u64)> {
        let total = file_size.div_ceil(CHUNK_SIZE) as u32;
        (0..total)
            .map(|i| {
                let offset = i as u64 * CHUNK_SIZE;
                let size = std::cmp::min(CHUNK_SIZE, file_size - offset);
                (i, offset, size)
            })
            .collect()
    }

    pub async fn download(
        &self,
        download_id: &str,
        download_url: &str,
        file: &mut tokio::fs::File,
        file_size: u64,
        pause_rx: watch::Receiver<bool>,
        mut on_progress: impl FnMut(f64) + Send,
    ) -> Result<(), String> {
        let chunks = Self::compute_chunks(file_size);
        let total = chunks.len() as u32;
        let completed = self
            .persistence
            .get_completed_chunk_count(download_id)
            .map_err(|e| e.to_string())?;

        if completed == 0 {
            self.persistence
                .init_chunks(download_id, &chunks)
                .map_err(|e| format!("Failed to init chunks: {}", e))?;
        }
        self.persistence
            .update_chunk_counts(download_id, total, completed)
            .map_err(|e| e.to_string())?;

        if file_size == 0 {
            file.set_len(0)
                .await
                .map_err(|e| format!("Cannot truncate empty file: {}", e))?;
            self.persistence
                .clear_chunks(download_id)
                .map_err(|e| e.to_string())?;
            return Ok(());
        }

        // Previous full-body attempt left partial data and no completed chunks.
        // Resume sequentially instead of restarting from byte 0.
        let existing_len = file.metadata().await.map(|m| m.len()).unwrap_or(0);
        if completed == 0 && existing_len > 0 {
            return self
                .stream_full_file(
                    download_id,
                    download_url,
                    file,
                    file_size,
                    None,
                    &pause_rx,
                    &mut on_progress,
                )
                .await;
        }

        let pending = self
            .persistence
            .get_pending_chunks(download_id)
            .map_err(|e| e.to_string())?;

        let mut completed_count = completed;

        for (chunk_index, offset, size) in pending {
            if *pause_rx.borrow() {
                return Err("Paused".to_string());
            }

            self.limiter.consume(size).await;

            let outcome = self
                .fetch_chunk_with_retries(download_url, chunk_index, offset, size, &pause_rx)
                .await?;

            match outcome {
                ChunkOutcome::Partial(bytes) => {
                    file.seek(tokio::io::SeekFrom::Start(offset))
                        .await
                        .map_err(|e| format!("Seek failed: {}", e))?;
                    file.write_all(&bytes)
                        .await
                        .map_err(|e| format!("Write failed: {}", e))?;
                    file.flush()
                        .await
                        .map_err(|e| format!("Flush failed: {}", e))?;

                    self.persistence
                        .mark_chunk_complete(download_id, chunk_index)
                        .map_err(|e| e.to_string())?;

                    completed_count += 1;
                    let progress = completed_count as f64 / total as f64;
                    self.persistence
                        .update_chunk_counts(download_id, total, completed_count)
                        .map_err(|e| e.to_string())?;

                    if *pause_rx.borrow() {
                        return Err("Paused".to_string());
                    }
                    on_progress(progress);
                }
                ChunkOutcome::FullBody { response } => {
                    if offset != 0 {
                        if let Some(resp) = response {
                            drop(resp);
                        }
                        return Err(
                            "Server does not support HTTP range requests; cannot resume a partial download. Remove and retry."
                                .to_string(),
                        );
                    }
                    return self
                        .stream_full_file(
                            download_id,
                            download_url,
                            file,
                            file_size,
                            response,
                            &pause_rx,
                            &mut on_progress,
                        )
                        .await;
                }
            }
        }

        self.persistence
            .clear_chunks(download_id)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn fetch_chunk_with_retries(
        &self,
        download_url: &str,
        chunk_index: u32,
        offset: u64,
        size: u64,
        pause_rx: &watch::Receiver<bool>,
    ) -> Result<ChunkOutcome, String> {
        let mut last_err = String::new();

        for attempt in 1..=MAX_CHUNK_RETRIES {
            if *pause_rx.borrow() {
                return Err("Paused".to_string());
            }

            match self
                .fetch_chunk_once(download_url, chunk_index, offset, size, pause_rx)
                .await
            {
                Ok(outcome) => return Ok(outcome),
                Err(e) if e == "Paused" || e == "LINK_EXPIRED" => return Err(e),
                Err(e) if e.starts_with("Chunk ") && e.contains("unexpected HTTP") => {
                    return Err(e);
                }
                Err(e) => {
                    last_err = e;
                    if attempt < MAX_CHUNK_RETRIES {
                        let delay_ms = 300 * attempt as u64;
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                    }
                }
            }
        }

        Err(format!(
            "Chunk {} failed after {} attempts: {}",
            chunk_index, MAX_CHUNK_RETRIES, last_err
        ))
    }

    async fn fetch_chunk_once(
        &self,
        download_url: &str,
        chunk_index: u32,
        offset: u64,
        size: u64,
        pause_rx: &watch::Receiver<bool>,
    ) -> Result<ChunkOutcome, String> {
        let range_header = format!("bytes={}-{}", offset, offset + size - 1);
        let response = self
            .client
            .get(download_url)
            .header("Range", &range_header)
            .header("Accept-Encoding", "identity")
            .send()
            .await
            .map_err(|e| format!("Chunk {} request failed: {}", chunk_index, e))?;

        let status = response.status();
        if status == reqwest::StatusCode::FORBIDDEN {
            return Err("LINK_EXPIRED".to_string());
        }

        // CDN ignored Range — stream this body (avoid a second GET that can fail on mobile).
        if status == reqwest::StatusCode::OK {
            return Ok(ChunkOutcome::FullBody {
                response: Some(response),
            });
        }

        if status != reqwest::StatusCode::PARTIAL_CONTENT {
            return Err(format!(
                "Chunk {} unexpected HTTP {}",
                chunk_index, status
            ));
        }

        let bytes = read_body_streaming(response, pause_rx)
            .await
            .map_err(|e| {
                if e == "Paused" {
                    e
                } else {
                    format!("Chunk {} read failed: {}", chunk_index, e)
                }
            })?;

        if bytes.len() as u64 != size {
            return Err(format!(
                "Chunk {} size mismatch: expected {}, got {}",
                chunk_index,
                size,
                bytes.len()
            ));
        }

        Ok(ChunkOutcome::Partial(bytes))
    }

    async fn stream_full_file(
        &self,
        download_id: &str,
        download_url: &str,
        file: &mut tokio::fs::File,
        file_size: u64,
        initial_response: Option<reqwest::Response>,
        pause_rx: &watch::Receiver<bool>,
        on_progress: &mut (impl FnMut(f64) + Send),
    ) -> Result<(), String> {
        let mut last_err = String::new();
        let mut pending_response = initial_response;

        for attempt in 1..=MAX_FULL_RETRIES {
            if *pause_rx.borrow() {
                return Err("Paused".to_string());
            }

            let start_offset = file.metadata().await.map(|m| m.len()).unwrap_or(0);
            if file_size > 0 && start_offset >= file_size {
                self.persistence
                    .clear_chunks(download_id)
                    .map_err(|e| e.to_string())?;
                on_progress(1.0);
                return Ok(());
            }

            // Probe response is always a full body from offset 0. Only reuse it then.
            let response = if start_offset == 0 {
                pending_response.take()
            } else {
                if let Some(resp) = pending_response.take() {
                    drop(resp);
                }
                None
            };

            match self
                .stream_full_file_once(
                    download_url,
                    file,
                    file_size,
                    start_offset,
                    response,
                    pause_rx,
                    on_progress,
                )
                .await
            {
                Ok(()) => {
                    self.persistence
                        .clear_chunks(download_id)
                        .map_err(|e| e.to_string())?;
                    on_progress(1.0);
                    return Ok(());
                }
                Err(e) if e == "Paused" || e == "LINK_EXPIRED" => return Err(e),
                Err(e) => {
                    last_err = e;
                    if attempt < MAX_FULL_RETRIES {
                        let delay_ms = 500 * attempt as u64;
                        tokio::time::sleep(Duration::from_millis(delay_ms.min(5_000))).await;
                    }
                }
            }
        }

        Err(format!(
            "Full download failed after {} attempts: {}",
            MAX_FULL_RETRIES, last_err
        ))
    }

    async fn stream_full_file_once(
        &self,
        download_url: &str,
        file: &mut tokio::fs::File,
        file_size: u64,
        start_offset: u64,
        existing_response: Option<reqwest::Response>,
        pause_rx: &watch::Receiver<bool>,
        on_progress: &mut (impl FnMut(f64) + Send),
    ) -> Result<(), String> {
        let response = match existing_response {
            Some(resp) => resp,
            None => {
                let mut req = self
                    .client
                    .get(download_url)
                    .header("Accept-Encoding", "identity");
                if start_offset > 0 {
                    req = req.header("Range", format!("bytes={}-", start_offset));
                }
                req.send()
                    .await
                    .map_err(|e| format!("Full download request failed: {}", e))?
            }
        };

        let status = response.status();
        if status == reqwest::StatusCode::FORBIDDEN {
            return Err("LINK_EXPIRED".to_string());
        }

        let mut write_offset = start_offset;
        if status == reqwest::StatusCode::PARTIAL_CONTENT {
            file.seek(tokio::io::SeekFrom::Start(start_offset))
                .await
                .map_err(|e| format!("Seek failed: {}", e))?;
        } else if status.is_success() {
            // Server returned the full body. Restart only when we had partial data.
            if start_offset > 0 {
                write_offset = 0;
                file.set_len(0)
                    .await
                    .map_err(|e| format!("Truncate failed: {}", e))?;
            }
            file.seek(tokio::io::SeekFrom::Start(0))
                .await
                .map_err(|e| format!("Seek failed: {}", e))?;
        } else {
            return Err(format!("Full download unexpected HTTP {}", status));
        }

        let total = if file_size > 0 {
            file_size
        } else {
            response
                .content_length()
                .map(|n| write_offset + n)
                .unwrap_or(1)
                .max(1)
        };

        let mut written = write_offset;
        let mut last_emit = Instant::now() - PROGRESS_EMIT_INTERVAL;
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;

        while let Some(item) = stream.next().await {
            if *pause_rx.borrow() {
                file.flush()
                    .await
                    .map_err(|e| format!("Flush failed: {}", e))?;
                return Err("Paused".to_string());
            }

            let chunk = match item {
                Ok(c) => c,
                Err(e) => {
                    let _ = file.flush().await;
                    return Err(format!("Full download stream failed: {}", e));
                }
            };
            if chunk.is_empty() {
                continue;
            }

            self.limiter.consume(chunk.len() as u64).await;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Write failed: {}", e))?;
            written += chunk.len() as u64;

            if last_emit.elapsed() >= PROGRESS_EMIT_INTERVAL {
                last_emit = Instant::now();
                let progress = (written as f64 / total as f64).clamp(0.0, 0.99);
                on_progress(progress);
            }
        }

        file.flush()
            .await
            .map_err(|e| format!("Flush failed: {}", e))?;

        if written == 0 {
            return Err("Full download produced empty body".to_string());
        }

        if file_size > 0 && written < file_size {
            return Err(format!(
                "Full download incomplete: got {} of {} bytes",
                written, file_size
            ));
        }

        Ok(())
    }
}

enum ChunkOutcome {
    Partial(bytes::Bytes),
    FullBody {
        response: Option<reqwest::Response>,
    },
}

async fn read_body_streaming(
    response: reqwest::Response,
    pause_rx: &watch::Receiver<bool>,
) -> Result<bytes::Bytes, String> {
    use futures_util::StreamExt;

    let mut stream = response.bytes_stream();
    let mut buf = Vec::new();

    while let Some(item) = stream.next().await {
        if *pause_rx.borrow() {
            return Err("Paused".to_string());
        }
        let chunk = item.map_err(|e| e.to_string())?;
        buf.extend_from_slice(&chunk);
    }

    Ok(bytes::Bytes::from(buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_chunks() {
        assert!(ChunkedDownloader::compute_chunks(0).is_empty());
        assert_eq!(ChunkedDownloader::compute_chunks(CHUNK_SIZE).len(), 1);
        assert_eq!(ChunkedDownloader::compute_chunks(CHUNK_SIZE + 1).len(), 2);
        let chunks = ChunkedDownloader::compute_chunks(CHUNK_SIZE * 3 + 1);
        assert_eq!(chunks.len(), 4);
        assert_eq!(chunks[3].2, 1);
    }
}

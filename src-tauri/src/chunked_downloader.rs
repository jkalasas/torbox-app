use std::sync::Arc;
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::watch;

use crate::bandwidth_limiter::BandwidthLimiter;
use crate::persistence::Persistence;

const CHUNK_SIZE: u64 = 4 * 1024 * 1024; // 4MB

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
        let total = ((file_size + CHUNK_SIZE - 1) / CHUNK_SIZE) as u32;
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
        dest_path: &str,
        file_size: u64,
        pause_rx: watch::Receiver<bool>,
        mut on_progress: impl FnMut(f64) + Send,
    ) -> Result<(), String> {
        // Initialize chunk manifest if not already done
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

        // Create parent directory if it does not exist
        if let Some(parent) = std::path::Path::new(dest_path).parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Cannot create directory: {}", e))?;
        }

        // Handle zero-byte files
        if file_size == 0 {
            tokio::fs::File::create(dest_path)
                .await
                .map_err(|e| format!("Cannot create {}: {}", dest_path, e))?;
            self.persistence
                .clear_chunks(download_id)
                .map_err(|e| e.to_string())?;
            return Ok(());
        }

        // Open file for writing (seek-based writes)
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .open(dest_path)
            .await
            .map_err(|e| format!("Cannot open {}: {}", dest_path, e))?;

        let pending = self
            .persistence
            .get_pending_chunks(download_id)
            .map_err(|e| e.to_string())?;

        let mut completed_count = completed;

        for (chunk_index, offset, size) in pending {
            // Check pause signal
            if *pause_rx.borrow() {
                return Err("Paused".to_string());
            }

            // Await bandwidth tokens
            self.limiter.consume(size).await;

            let range_header = format!("bytes={}-{}", offset, offset + size - 1);
            let response = self
                .client
                .get(download_url)
                .header("Range", &range_header)
                .send()
                .await
                .map_err(|e| format!("Chunk {} request failed: {}", chunk_index, e))?;

            if response.status() == reqwest::StatusCode::FORBIDDEN {
                return Err("LINK_EXPIRED".to_string());
            }
            if response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
                return Err(format!(
                    "Chunk {} unexpected HTTP {}",
                    chunk_index,
                    response.status()
                ));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| format!("Chunk {} read failed: {}", chunk_index, e))?;

            if bytes.len() as u64 != size {
                return Err(format!(
                    "Chunk {} size mismatch: expected {}, got {}",
                    chunk_index,
                    size,
                    bytes.len()
                ));
            }

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
            (on_progress)(progress);
            self.persistence
                .update_chunk_counts(download_id, total, completed_count)
                .map_err(|e| e.to_string())?;
        }

        // All chunks done
        self.persistence
            .clear_chunks(download_id)
            .map_err(|e| e.to_string())?;
        Ok(())
    }
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

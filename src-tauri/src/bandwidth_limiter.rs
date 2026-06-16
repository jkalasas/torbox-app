use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration, Instant};

#[derive(Clone)]
pub struct BandwidthLimiter {
    inner: Arc<Mutex<Inner>>,
}

struct Inner {
    tokens: f64,
    rate: f64,          // bytes per second
    max_tokens: f64,
    last_refill: Instant,
}

impl BandwidthLimiter {
    pub fn new(rate_kibps: u64) -> Self {
        let rate = rate_kibps as f64 * 1024.0;
        Self {
            inner: Arc::new(Mutex::new(Inner {
                tokens: 0.0,
                rate,
                max_tokens: rate,
                last_refill: Instant::now(),
            })),
        }
    }

    pub async fn set_rate(&self, rate_kibps: u64) {
        let rate = rate_kibps as f64 * 1024.0;
        let mut inner = self.inner.lock().await;
        inner.rate = rate;
        inner.max_tokens = rate;
        if inner.tokens > rate {
            inner.tokens = rate;
        }
    }

    /// Wait until `bytes` tokens are available, consuming them.
    /// Returns immediately if rate is 0 (unlimited).
    pub async fn consume(&self, bytes: u64) {
        if bytes == 0 {
            return;
        }
        let needed = bytes as f64;
        loop {
            let mut inner = self.inner.lock().await;
            if inner.rate == 0.0 {
                return;
            }

            let now = Instant::now();
            let elapsed = now.duration_since(inner.last_refill).as_secs_f64();
            inner.tokens = (inner.tokens + elapsed * inner.rate).min(inner.max_tokens);
            inner.last_refill = now;

            if inner.tokens >= needed {
                inner.tokens -= needed;
                return;
            }

            let deficit = needed - inner.tokens;
            inner.tokens = 0.0;
            let wait_secs = deficit / inner.rate;
            drop(inner);
            sleep(Duration::from_secs_f64(wait_secs)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_unlimited_rate() {
        let limiter = BandwidthLimiter::new(0);
        let start = Instant::now();
        limiter.consume(1024 * 1024 * 100).await; // 100MB
        assert!(start.elapsed().as_millis() < 100);
    }

    #[tokio::test]
    async fn test_rate_limiting() {
        let limiter = BandwidthLimiter::new(1024); // 1 MB/s
        let start = Instant::now();
        limiter.consume(512 * 1024).await; // 0.5MB → should take ~0.5s
        let elapsed = start.elapsed().as_millis();
        assert!(elapsed >= 400, "expected >=400ms, got {}ms", elapsed);
    }

    #[tokio::test]
    async fn test_set_rate() {
        let limiter = BandwidthLimiter::new(10240);
        limiter.set_rate(1024).await;
        let start = Instant::now();
        limiter.consume(512 * 1024).await;
        assert!(start.elapsed().as_millis() >= 400);
    }

    #[tokio::test]
    async fn test_sequential_consume_deducts() {
        let limiter = BandwidthLimiter::new(1024); // 1 MiB/s
        let start = Instant::now();
        limiter.consume(512 * 1024).await;
        limiter.consume(512 * 1024).await;
        let elapsed = start.elapsed().as_secs_f64();
        assert!(
            elapsed >= 0.8,
            "expected sequential 1MiB to take >=0.8s, got {}s",
            elapsed
        );
    }

    #[tokio::test]
    async fn test_concurrent_consume_deducts() {
        let limiter = BandwidthLimiter::new(1024); // 1 MiB/s
        let limiter_b = limiter.clone();
        let start = Instant::now();
        let (a, b) = tokio::join!(
            limiter.consume(512 * 1024),
            limiter_b.consume(512 * 1024)
        );
        let _ = (a, b);
        let elapsed = start.elapsed().as_secs_f64();
        assert!(
            elapsed >= 0.8,
            "expected concurrent 1MiB to take >=0.8s, got {}s",
            elapsed
        );
    }
}

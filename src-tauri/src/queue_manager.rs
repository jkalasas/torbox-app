use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, OwnedSemaphorePermit, Semaphore};

#[derive(Debug, Clone, PartialEq)]
pub enum QueueEvent {
    Activate(String),
    Remove(String),
    Pause(String),
    Resume(String),
}

pub struct QueueManager {
    queue: Arc<Mutex<VecDeque<String>>>,
    active: Arc<Mutex<Vec<String>>>,
    semaphore: Mutex<Arc<Semaphore>>,
    event_tx: mpsc::UnboundedSender<QueueEvent>,
}

impl QueueManager {
    pub fn new(max_concurrent: u32) -> (Self, mpsc::UnboundedReceiver<QueueEvent>) {
        assert!(max_concurrent > 0, "max_concurrent must be greater than 0");
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        (
            Self {
                queue: Arc::new(Mutex::new(VecDeque::new())),
                active: Arc::new(Mutex::new(Vec::new())),
                semaphore: Mutex::new(Arc::new(Semaphore::new(max_concurrent as usize))),
                event_tx,
            },
            event_rx,
        )
    }

    /// Sets the maximum number of concurrent downloads.
    ///
    /// This only affects new downloads that acquire slots after the change.
    /// Active downloads continue using the previous semaphore until they finish.
    pub async fn set_max_concurrent(&self, max: u32) {
        assert!(max > 0, "max_concurrent must be greater than 0");
        let mut sem = self.semaphore.lock().await;
        *sem = Arc::new(Semaphore::new(max as usize));
    }

    pub async fn enqueue(&self, download_id: String) -> usize {
        let mut queue = self.queue.lock().await;
        queue.push_back(download_id);
        queue.len()
    }

    pub async fn acquire_slot(&self) -> Result<OwnedSemaphorePermit, String> {
        let sem = {
            let guard = self.semaphore.lock().await;
            guard.clone()
        };
        sem.acquire_owned()
            .await
            .map_err(|_| "Semaphore closed".to_string())
    }

    pub async fn activate(&self, download_id: String) {
        {
            let mut queue = self.queue.lock().await;
            queue.retain(|id| id != &download_id);
        }
        {
            let mut active = self.active.lock().await;
            if !active.contains(&download_id) {
                active.push(download_id.clone());
            }
        }
        self.event_tx.send(QueueEvent::Activate(download_id)).ok();
    }

    pub async fn deactivate(&self, download_id: &str) {
        let mut active = self.active.lock().await;
        active.retain(|id| id != download_id);
    }

    pub async fn remove(&self, download_id: &str) {
        {
            let mut queue = self.queue.lock().await;
            queue.retain(|id| id != download_id);
        }
        {
            let mut active = self.active.lock().await;
            active.retain(|id| id != download_id);
        }
        self.event_tx.send(QueueEvent::Remove(download_id.to_string())).ok();
    }

    pub async fn pause(&self, download_id: &str) {
        self.event_tx.send(QueueEvent::Pause(download_id.to_string())).ok();
    }

    pub async fn resume(&self, download_id: &str) {
        self.event_tx.send(QueueEvent::Resume(download_id.to_string())).ok();
    }

    pub async fn queue_position(&self, download_id: &str) -> Option<usize> {
        let queue = self.queue.lock().await;
        let active = self.active.lock().await;
        if active.iter().any(|id| id == download_id) {
            return Some(0);
        }
        queue.iter().position(|id| id == download_id).map(|p| p + 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_enqueue_and_activate() {
        let (qm, mut rx) = QueueManager::new(2);
        let pos = qm.enqueue("d1".to_string()).await;
        assert_eq!(pos, 1);

        qm.activate("d1".to_string()).await;
        assert_eq!(rx.recv().await, Some(QueueEvent::Activate("d1".to_string())));
        assert_eq!(qm.queue_position("d1").await, Some(0));
    }
}

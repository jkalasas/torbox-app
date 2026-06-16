use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{Mutex, Notify, OwnedSemaphorePermit, Semaphore};

pub struct QueueManager {
    queue: Arc<Mutex<VecDeque<String>>>,
    active: Arc<Mutex<Vec<String>>>,
    semaphore: Mutex<Arc<Semaphore>>,
    notify: Arc<Notify>,
}

impl QueueManager {
    pub fn new(max_concurrent: u32) -> Self {
        assert!(max_concurrent > 0, "max_concurrent must be greater than 0");
        Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
            active: Arc::new(Mutex::new(Vec::new())),
            semaphore: Mutex::new(Arc::new(Semaphore::new(max_concurrent as usize))),
            notify: Arc::new(Notify::new()),
        }
    }

    pub async fn wait_for_change(&self) {
        self.notify.notified().await;
    }

    pub async fn set_max_concurrent(&self, max: u32) {
        assert!(max > 0, "max_concurrent must be greater than 0");
        let mut sem = self.semaphore.lock().await;
        *sem = Arc::new(Semaphore::new(max as usize));
    }

    pub async fn enqueue(&self, download_id: String) -> usize {
        let mut queue = self.queue.lock().await;
        queue.push_back(download_id);
        let position = queue.len();
        drop(queue);
        self.notify.notify_one();
        position
    }

    pub async fn pop(&self) -> Option<String> {
        let mut queue = self.queue.lock().await;
        queue.pop_front()
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
    async fn test_enqueue_and_pop() {
        let qm = QueueManager::new(2);
        let pos = qm.enqueue("d1".to_string()).await;
        assert_eq!(pos, 1);
        assert_eq!(qm.pop().await, Some("d1".to_string()));
        assert_eq!(qm.pop().await, None);
    }
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${UNITS[i]}`;
}

/** Format bytes per second to human-readable speed */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) {
    return '0 B/s';
  }
  return `${formatBytes(bytesPerSec)}/s`;
}

/** Format seconds to human-readable duration */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return '';
  }
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Format a date relative to now */
export function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString();
}

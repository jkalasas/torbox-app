import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatSpeed } from './format';

describe('format utils', () => {
  describe('formatBytes', () => {
    it('returns 0 B for zero or negative values', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(-1)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('formatSpeed', () => {
    it('returns 0 B/s for zero', () => {
      expect(formatSpeed(0)).toBe('0 B/s');
    });

    it('appends /s to byte formatting', () => {
      expect(formatSpeed(1024)).toBe('1.00 KB/s');
    });
  });

  describe('formatDuration', () => {
    it('returns empty string for zero or negative', () => {
      expect(formatDuration(0)).toBe('');
      expect(formatDuration(-1)).toBe('');
    });

    it('formats seconds', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(3665)).toBe('1h 1m');
    });
  });
});

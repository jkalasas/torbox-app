import { describe, expect, it } from 'vitest';
import {
  ensureExtension,
  extensionFromMime,
  fileBasename,
  hasPlausibleExtension,
  resolveFileDownloadName,
  resolveZipDownloadName,
} from './fileName';

describe('fileName utils', () => {
  describe('fileBasename', () => {
    it('returns the last path segment', () => {
      expect(fileBasename('Season 1/Episode.mkv')).toBe('Episode.mkv');
      expect(fileBasename('Episode.mkv')).toBe('Episode.mkv');
      expect(fileBasename('a\\b\\c.txt')).toBe('c.txt');
    });
  });

  describe('hasPlausibleExtension', () => {
    it('detects common extensions on the basename only', () => {
      expect(hasPlausibleExtension('movie.mkv')).toBe(true);
      expect(hasPlausibleExtension('Dir.Name/movie')).toBe(false);
      expect(hasPlausibleExtension('Dir.Name/movie.mp4')).toBe(true);
      expect(hasPlausibleExtension('.hidden')).toBe(false);
      expect(hasPlausibleExtension('noext')).toBe(false);
    });
  });

  describe('extensionFromMime', () => {
    it('maps known mime types', () => {
      expect(extensionFromMime('video/x-matroska')).toBe('mkv');
      expect(extensionFromMime('video/mp4; charset=binary')).toBe('mp4');
      expect(extensionFromMime('application/pdf')).toBe('pdf');
    });

    it('returns null for unknown or generic types', () => {
      expect(extensionFromMime(null)).toBeNull();
      expect(extensionFromMime('application/octet-stream')).toBeNull();
      expect(extensionFromMime('application/vnd.custom+xml')).toBeNull();
    });
  });

  describe('ensureExtension', () => {
    it('appends when missing and is case-insensitive', () => {
      expect(ensureExtension('Movie', 'mkv')).toBe('Movie.mkv');
      expect(ensureExtension('Movie.MKV', 'mkv')).toBe('Movie.MKV');
      expect(ensureExtension('Folder/Movie', 'mp4')).toBe('Folder/Movie.mp4');
    });
  });

  describe('resolveZipDownloadName', () => {
    it('always ends with .zip for archive transfers', () => {
      expect(resolveZipDownloadName('My Torrent')).toBe('My Torrent.zip');
      expect(resolveZipDownloadName('My Torrent.zip')).toBe('My Torrent.zip');
      expect(resolveZipDownloadName('movie.mkv')).toBe('movie.mkv.zip');
      expect(resolveZipDownloadName('  ')).toBe('download.zip');
    });
  });

  describe('resolveFileDownloadName', () => {
    it('keeps names that already have an extension', () => {
      expect(resolveFileDownloadName('Show/S01E01.mkv', { mimeType: 'video/mp4' })).toBe(
        'Show/S01E01.mkv'
      );
    });

    it('adds extension from mime when the name has none', () => {
      expect(
        resolveFileDownloadName('Show/S01E01', { mimeType: 'video/x-matroska' })
      ).toBe('Show/S01E01.mkv');
    });

    it('uses short_name extension when the full name has none', () => {
      expect(
        resolveFileDownloadName('Show/S01E01', {
          shortName: 'S01E01.mp4',
          mimeType: 'video/x-matroska',
        })
      ).toBe('Show/S01E01.mp4');
    });

    it('falls back to short_name when name is empty', () => {
      expect(
        resolveFileDownloadName('', {
          shortName: 'clip',
          mimeType: 'video/mp4',
        })
      ).toBe('clip.mp4');
    });

    it('leaves the name unchanged when no extension can be inferred', () => {
      expect(resolveFileDownloadName('readme', { mimeType: null })).toBe('readme');
    });
  });
});

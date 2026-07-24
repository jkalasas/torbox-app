export function fileBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter((p) => p.length > 0);
  return parts[parts.length - 1] ?? path;
}

export function formatDisplayPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  if (!trimmed.startsWith('content://')) {
    return trimmed;
  }

  try {
    const withoutQuery = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
    const segments = withoutQuery.split('/').filter((part) => part.length > 0);
    const last = segments[segments.length - 1] ?? trimmed;
    const decoded = decodeURIComponent(last);
    const colon = decoded.lastIndexOf(':');
    const label = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    return label || decoded || trimmed;
  } catch {
    return trimmed;
  }
}

export function hasPlausibleExtension(fileName: string): boolean {
  const base = fileBasename(fileName);
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return false;
  }
  const ext = base.slice(dot + 1);
  return /^[A-Za-z0-9+]{1,10}$/.test(ext);
}

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-ms-wmv': 'wmv',
  'video/mp2t': 'ts',
  'video/mpeg': 'mpeg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aac': 'aac',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/vnd.rar': 'rar',
  'application/x-bittorrent': 'torrent',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'application/epub+zip': 'epub',
  'application/x-iso9660-image': 'iso',
  'application/x-apple-diskimage': 'dmg',
};

export function extensionFromMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }
  const mime = mimeType.split(';')[0]?.trim().toLowerCase();
  if (!mime) {
    return null;
  }
  if (MIME_TO_EXT[mime]) {
    return MIME_TO_EXT[mime];
  }
  const slash = mime.lastIndexOf('/');
  if (slash < 0) {
    return null;
  }
  const subtype = mime.slice(slash + 1);
  if (subtype.startsWith('x-') || subtype.includes('.') || subtype.includes('+')) {
    return null;
  }
  if (/^[a-z0-9]{1,10}$/.test(subtype)) {
    return subtype;
  }
  return null;
}

export function ensureExtension(path: string, ext: string): string {
  const clean = ext.replace(/^\./, '').toLowerCase();
  if (!clean) {
    return path;
  }
  const base = fileBasename(path);
  if (base.toLowerCase().endsWith(`.${clean}`)) {
    return path;
  }
  return `${path}.${clean}`;
}

export function resolveZipDownloadName(name: string): string {
  const trimmed = name.trim() || 'download';
  if (fileBasename(trimmed).toLowerCase().endsWith('.zip')) {
    return trimmed;
  }
  return `${trimmed}.zip`;
}

export interface ResolveFileDownloadNameOptions {
  shortName?: string | null;
  mimeType?: string | null;
}

export function resolveFileDownloadName(
  name: string,
  options: ResolveFileDownloadNameOptions = {}
): string {
  const trimmedName = name.trim();
  const trimmedShort = options.shortName?.trim() || '';
  const path = trimmedName || trimmedShort || 'download';

  if (hasPlausibleExtension(path)) {
    return path;
  }

  if (trimmedShort && hasPlausibleExtension(trimmedShort)) {
    const ext = trimmedShort.slice(trimmedShort.lastIndexOf('.') + 1);
    return ensureExtension(path, ext);
  }

  const fromMime = extensionFromMime(options.mimeType);
  if (fromMime) {
    return ensureExtension(path, fromMime);
  }

  return path;
}

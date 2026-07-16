export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
}

export function isDesktopShell(): boolean {
  return isTauri() && !/Android|iPhone|iPod|iPad/i.test(navigator.userAgent);
}

export function showCustomWindowControls(): boolean {
  return isDesktopShell() && !isMacOS();
}

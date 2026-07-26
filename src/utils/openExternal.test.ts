import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternalUrl } from './openExternal';

const { openUrl, isTauri } = vi.hoisted(() => ({
  openUrl: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl,
}));

vi.mock('./platform', () => ({
  isTauri,
}));

describe('openExternalUrl', () => {
  beforeEach(() => {
    openUrl.mockReset();
    isTauri.mockReset();
    vi.stubGlobal('open', vi.fn());
  });

  it('uses the opener plugin inside Tauri', async () => {
    isTauri.mockReturnValue(true);
    openUrl.mockResolvedValue(undefined);

    await openExternalUrl('https://github.com/jkalasas/torbox-app/releases');

    expect(openUrl).toHaveBeenCalledWith('https://github.com/jkalasas/torbox-app/releases');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('falls back to window.open outside Tauri', async () => {
    isTauri.mockReturnValue(false);

    await openExternalUrl('https://torbox.app/settings');

    expect(openUrl).not.toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith(
      'https://torbox.app/settings',
      '_blank',
      'noopener,noreferrer'
    );
  });
});

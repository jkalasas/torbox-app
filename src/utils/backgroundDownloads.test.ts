import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import {
  getBackgroundStatus,
  isBackgroundReady,
  requestBackgroundPermissions,
} from './backgroundDownloads';

const mockedInvoke = vi.mocked(invoke);

describe('backgroundDownloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when status cannot be read', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('unavailable'));
    await expect(getBackgroundStatus()).resolves.toBeNull();
  });

  it('requests permissions then refreshes status', async () => {
    const status = { batteryUnrestricted: true, notificationsGranted: true };
    mockedInvoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce(status);

    await expect(requestBackgroundPermissions()).resolves.toEqual(status);
    expect(mockedInvoke).toHaveBeenNthCalledWith(1, 'request_background_permissions');
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, 'get_background_status');
  });

  it('detects when background downloads are fully enabled', () => {
    expect(isBackgroundReady(null)).toBe(false);
    expect(isBackgroundReady({ batteryUnrestricted: true, notificationsGranted: false })).toBe(
      false
    );
    expect(isBackgroundReady({ batteryUnrestricted: true, notificationsGranted: true })).toBe(true);
  });
});

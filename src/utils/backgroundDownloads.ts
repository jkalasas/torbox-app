import { invoke } from '@tauri-apps/api/core';

export type BackgroundStatus = {
  batteryUnrestricted: boolean;
  notificationsGranted: boolean;
};

export async function getBackgroundStatus(): Promise<BackgroundStatus | null> {
  try {
    return await invoke<BackgroundStatus>('get_background_status');
  } catch {
    return null;
  }
}

export async function requestBackgroundPermissions(): Promise<BackgroundStatus | null> {
  await invoke('request_background_permissions');
  return getBackgroundStatus();
}

export function isBackgroundReady(status: BackgroundStatus | null): boolean {
  return Boolean(status?.batteryUnrestricted && status?.notificationsGranted);
}

import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useState } from 'react';
import { isDesktopShell } from '../utils/platform';

export interface UseUpdaterReturn {
  availableUpdate: Update | null;
  checking: boolean;
  installing: boolean;
  progress: number;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  relaunchApp: () => Promise<void>;
  releasesUrl: string;
}

const RELEASES_URL = 'https://github.com/jkalasas/torbox-app/releases';

export function useUpdater(): UseUpdaterReturn {
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const desktop = isDesktopShell();

  const checkForUpdate = useCallback(async () => {
    if (!desktop) {
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const update = await check();
      setAvailableUpdate(update);
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
    }
  }, [desktop]);

  const installUpdate = useCallback(async () => {
    if (!availableUpdate) {
      return;
    }
    setInstalling(true);
    setProgress(0);
    setError(null);
    try {
      let downloaded = 0;
      let contentLength = 0;
      await availableUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.min(99, Math.floor((downloaded / contentLength) * 100)));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  }, [availableUpdate]);

  const relaunchApp = useCallback(async () => {
    try {
      await relaunch();
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    if (desktop) {
      void checkForUpdate();
    }
  }, [desktop, checkForUpdate]);

  return {
    availableUpdate,
    checking,
    installing,
    progress,
    error,
    checkForUpdate,
    installUpdate,
    relaunchApp,
    releasesUrl: RELEASES_URL,
  };
}

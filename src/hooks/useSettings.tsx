import { invoke } from '@tauri-apps/api/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DownloadSettings } from '../types/downloads';

const DEFAULTS: DownloadSettings = {
  api_key: '',
  download_dir: '',
  max_concurrent: 3,
  bandwidth_limit: 0,
  notify_on_complete: true,
  open_folder_on_complete: true,
  color_mode: 'dark',
};

export interface UseSettingsReturn {
  settings: DownloadSettings;
  saving: boolean;
  saved: boolean;
  ready: boolean;
  error: string | null;
  updateSetting: <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => void;
  saveSettings: () => Promise<void>;
}

const SettingsContext = createContext<UseSettingsReturn | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const s = await invoke<DownloadSettings>('get_settings', {});
        setSettings(s);
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    };
    void init();

    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const updateSetting = useCallback(
    <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const saveSettings = useCallback(async () => {
    setSaving(true);
    setError(null);
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    try {
      await invoke('update_settings', {
        settings: settings as unknown as Record<string, unknown>,
      });
      setSaving(false);
      setSaved(true);
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaving(false);
      setError(String(e));
    }
  }, [settings]);

  const value = useMemo<UseSettingsReturn>(
    () => ({
      settings,
      saving,
      saved,
      ready,
      error,
      updateSetting,
      saveSettings,
    }),
    [settings, saving, saved, ready, error, updateSetting, saveSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): UseSettingsReturn {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

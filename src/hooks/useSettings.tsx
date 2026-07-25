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
  close_to_tray: true,
  color_mode: 'dark',
};

export interface UseSettingsReturn {
  settings: DownloadSettings;
  saving: boolean;
  saved: boolean;
  ready: boolean;
  error: string | null;
  updateSetting: <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => void;
  saveSettings: (next?: DownloadSettings) => Promise<DownloadSettings>;
}

const SettingsContext = createContext<UseSettingsReturn | null>(null);

function normalizeSettings(settings: DownloadSettings): DownloadSettings {
  return {
    ...settings,
    api_key: settings.api_key.trim(),
    download_dir: settings.download_dir.trim(),
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const init = async () => {
      try {
        const s = await invoke<DownloadSettings>('get_settings', {});
        const normalized = normalizeSettings(s);
        setSettings(normalized);
        setReady(true);
      } catch (e) {
        setError(String(e));
        setReady(true);
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

  const saveSettings = useCallback(async (next?: DownloadSettings) => {
    const toSave = normalizeSettings(next ?? settingsRef.current);
    setSaving(true);
    setError(null);
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    try {
      await invoke('update_settings', {
        settings: toSave as unknown as Record<string, unknown>,
      });
      // Backend may normalize download_dir (empty → app storage on mobile).
      const persisted = await invoke<DownloadSettings>('get_settings', {});
      const normalized = normalizeSettings(persisted);
      setSettings(normalized);
      setSaving(false);
      setSaved(true);
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 2000);
      return normalized;
    } catch (e) {
      setSaving(false);
      setError(String(e));
      throw e;
    }
  }, []);

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

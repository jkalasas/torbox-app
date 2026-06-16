import { load } from '@tauri-apps/plugin-store';
import { useCallback, useEffect, useState } from 'react';

const STORE_PATH = 'settings.json';
const API_KEY_KEY = 'api_key';

export interface UseSettingsReturn {
  apiKey: string;
  savedApiKey: string;
  setApiKey: (key: string) => void;
  saveApiKey: () => Promise<void>;
  saving: boolean;
  saved: boolean;
  ready: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [store, setStore] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [savedApiKey, setSavedApiKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  // Load the store on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const s = await load(STORE_PATH, { defaults: {}, autoSave: false });
      if (cancelled) {
        return;
      }
      const existing = await s.get<string>(API_KEY_KEY);
      const key = existing ?? '';
      setStore(s);
      setSavedApiKey(key);
      setApiKey(key);
      setReady(true);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveApiKey = useCallback(async () => {
    if (!store) {
      return;
    }
    setSaving(true);

    if (apiKey) {
      await store.set(API_KEY_KEY, apiKey);
    } else {
      await store.delete(API_KEY_KEY);
    }
    await store.save();

    setSavedApiKey(apiKey);
    setSaving(false);
    setSaved(true);

    // Reset saved indicator after a brief moment
    setTimeout(() => setSaved(false), 2000);
  }, [store, apiKey]);

  return { apiKey, savedApiKey, setApiKey, saveApiKey, saving, saved, ready };
}

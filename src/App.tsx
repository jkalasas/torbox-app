import '@mantine/core/styles.css';
import './styles/global.css';
import { MantineProvider, useMantineColorScheme } from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SetupWizard } from './components/SetupWizard/SetupWizard';
import { SettingsProvider, useSettings } from './hooks/useSettings';
import { Router } from './Router';
import { theme } from './theme';
import type { DownloadSettings } from './types/downloads';

function ColorSchemeSync() {
  const { settings } = useSettings();
  const { setColorScheme } = useMantineColorScheme();
  const setColorSchemeRef = useRef(setColorScheme);

  useEffect(() => {
    setColorSchemeRef.current = setColorScheme;
  }, [setColorScheme]);

  useEffect(() => {
    setColorSchemeRef.current(settings.color_mode);
  }, [settings.color_mode]);

  return null;
}

function AppContent() {
  const { settings, saveSettings, saving, ready, error } = useSettings();
  const [forceSetup, setForceSetup] = useState(false);
  const [forceSetupReady, setForceSetupReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void invoke<boolean>('should_force_setup')
      .then((value) => {
        if (!cancelled) {
          setForceSetup(value);
          setForceSetupReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setForceSetup(false);
          setForceSetupReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetupComplete = useCallback(
    async (next: DownloadSettings) => {
      const saved = await saveSettings(next);
      setForceSetup(false);
      return saved;
    },
    [saveSettings]
  );

  if (!ready || !forceSetupReady) {
    return null;
  }

  if (forceSetup || !settings.api_key) {
    return (
      <SetupWizard
        initialSettings={settings}
        saving={saving}
        error={error}
        onComplete={handleSetupComplete}
      />
    );
  }

  return <Router />;
}

function AppInner() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ColorSchemeSync />
      <AppContent />
    </MantineProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppInner />
    </SettingsProvider>
  );
}

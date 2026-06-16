import '@mantine/core/styles.css';
import './styles/global.css';
import { MantineProvider, useMantineColorScheme } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { SettingsProvider, useSettings } from './hooks/useSettings';
import { Router } from './Router';
import { theme } from './theme';

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

function AppInner() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ColorSchemeSync />
      <Router />
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

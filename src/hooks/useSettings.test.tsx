import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSettings, SettingsProvider } from './useSettings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function TestComponent() {
  const { settings, ready } = useSettings();
  return <div>{ready ? `mode:${settings.color_mode}` : 'loading'}</div>;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

describe('useSettings', () => {
  it('loads saved color mode from backend', async () => {
    const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;
    mockInvoke.mockResolvedValue({
      api_key: '',
      download_dir: '',
      max_concurrent: 3,
      bandwidth_limit: 0,
      notify_on_complete: true,
      open_folder_on_complete: true,
      color_mode: 'light',
    });

    render(<TestComponent />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('mode:light')).toBeInTheDocument());
  });

  it('defaults to dark color mode', async () => {
    const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;
    mockInvoke.mockResolvedValue({
      api_key: '',
      download_dir: '',
      max_concurrent: 3,
      bandwidth_limit: 0,
      notify_on_complete: true,
      open_folder_on_complete: true,
      color_mode: 'dark',
    });

    render(<TestComponent />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('mode:dark')).toBeInTheDocument());
  });
});

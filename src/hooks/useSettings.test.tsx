import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSettings, SettingsProvider } from './useSettings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function TestComponent() {
  const { settings, ready, saveSettings, saving, saved } = useSettings();
  return (
    <div>
      <div>{ready ? `mode:${settings.color_mode}` : 'loading'}</div>
      <div>{`key:${settings.api_key}`}</div>
      <div>{saving ? 'saving' : 'idle'}</div>
      <div>{saved ? 'saved' : 'unsaved'}</div>
      <button
        type="button"
        onClick={() => {
          void saveSettings({
            api_key: '  pasted-key  ',
            download_dir: ' /tmp/torbox ',
            max_concurrent: 3,
            bandwidth_limit: 0,
            notify_on_complete: true,
            open_folder_on_complete: true,
            color_mode: 'light',
          });
        }}
      >
        save
      </button>
    </div>
  );
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

  it('persists trimmed settings payload to the backend', async () => {
    const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_settings') {
        return {
          api_key: '',
          download_dir: '',
          max_concurrent: 3,
          bandwidth_limit: 0,
          notify_on_complete: true,
          open_folder_on_complete: true,
          color_mode: 'dark',
        };
      }
      if (cmd === 'update_settings') {
        return undefined;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    render(<TestComponent />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('mode:dark')).toBeInTheDocument());

    await act(async () => {
      screen.getByRole('button', { name: 'save' }).click();
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_settings', {
        settings: expect.objectContaining({
          api_key: 'pasted-key',
          download_dir: '/tmp/torbox',
          color_mode: 'light',
        }),
      });
    });

    await waitFor(() => expect(screen.getByText('key:pasted-key')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('mode:light')).toBeInTheDocument());
  });
});

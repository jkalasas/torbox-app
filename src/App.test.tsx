import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import type { DownloadSettings } from './types/downloads';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(async () => 'linux'),
}));

import { invoke } from '@tauri-apps/api/core';

vi.mock('./Router', () => ({
  Router: () => <div data-testid="router">Router</div>,
}));

const emptySettings: DownloadSettings = {
  api_key: '',
  download_dir: '',
  max_concurrent: 3,
  bandwidth_limit: 0,
  notify_on_complete: true,
  open_folder_on_complete: true,
  color_mode: 'dark',
};

function mockInvoke(settings: typeof emptySettings, forceSetup = false) {
  const mock = invoke as unknown as ReturnType<typeof vi.fn>;
  mock.mockImplementation(async (cmd: string) => {
    if (cmd === 'should_force_setup') {
      return forceSetup;
    }
    if (cmd === 'get_settings' || cmd === 'update_settings') {
      return settings;
    }
    return settings;
  });
  return mock;
}

describe('App', () => {
  it('applies light color mode from settings', async () => {
    mockInvoke({
      ...emptySettings,
      color_mode: 'light',
    });

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light')
    );
  });

  it('follows system preference when color mode is auto', async () => {
    mockInvoke({
      ...emptySettings,
      color_mode: 'auto',
    });

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light')
    );
  });

  it('shows the setup wizard when no API key is configured', async () => {
    mockInvoke(emptySettings);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TorBox' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('router')).not.toBeInTheDocument();
  });

  it('shows the main app when an API key is configured', async () => {
    mockInvoke({
      ...emptySettings,
      api_key: 'configured-key',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('router')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'TorBox' })).not.toBeInTheDocument();
  });

  it('shows the setup wizard when --setup force flag is set', async () => {
    mockInvoke(
      {
        ...emptySettings,
        api_key: 'configured-key',
      },
      true
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'TorBox' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('router')).not.toBeInTheDocument();
  });
});

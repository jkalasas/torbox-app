import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

vi.mock('./Router', () => ({
  Router: () => <div data-testid="router">Router</div>,
}));

describe('App', () => {
  it('applies light color mode from settings', async () => {
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

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light')
    );
  });

  it('follows system preference when color mode is auto', async () => {
    const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;
    mockInvoke.mockResolvedValue({
      api_key: '',
      download_dir: '',
      max_concurrent: 3,
      bandwidth_limit: 0,
      notify_on_complete: true,
      open_folder_on_complete: true,
      color_mode: 'auto',
    });

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light')
    );
  });
});

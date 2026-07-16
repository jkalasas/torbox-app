import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../test-utils';
import { DownloadsPage } from './Downloads.page';

vi.mock('../hooks/useDownloads', () => ({
  useDownloads: vi.fn(() => ({
    downloads: [],
    loading: false,
    error: null,
    addDownload: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    removeDownload: vi.fn(),
    retryDownload: vi.fn(),
    refresh: vi.fn(),
    byType: vi.fn(() => []),
    counts: { total: 0, active: 0, error: 0, torrents: 0, web: 0 },
  })),
}));

vi.mock('../hooks/useLocalTransfers', () => ({
  useLocalTransfers: vi.fn(() => ({
    transfers: [],
    loading: false,
    error: null,
    startTransfer: vi.fn(),
    removeTransfer: vi.fn(),
    retryTransfer: vi.fn(),
    refresh: vi.fn(),
    counts: { total: 0, active: 0, error: 0 },
  })),
}));

vi.mock('../hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    settings: {
      api_key: '',
      download_dir: '',
      max_concurrent: 3,
      bandwidth_limit: 0,
      notify_on_complete: true,
      open_folder_on_complete: true,
      color_mode: 'dark',
    },
    updateSetting: vi.fn(),
    saveSettings: vi.fn(),
    saving: false,
    saved: false,
    ready: true,
    error: null,
  })),
}));

describe('DownloadsPage', () => {
  it('renders the motrix-style shell with status navigation', () => {
    render(<DownloadsPage />);

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Torrents' })).toBeInTheDocument();
  });

  it('exposes cloud and local mode controls', () => {
    render(<DownloadsPage />);

    expect(screen.getByRole('tab', { name: 'Cloud downloads' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Local transfers' })).toBeInTheDocument();
  });
});

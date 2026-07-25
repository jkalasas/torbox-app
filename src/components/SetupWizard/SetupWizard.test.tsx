import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../../test-utils';
import type { DownloadSettings } from '../../types/downloads';
import { SetupWizard } from './SetupWizard';

vi.mock('../../api/torbox', () => ({
  validateApiKey: vi.fn(),
  TorBoxApiError: class TorBoxApiError extends Error {
    status: number | undefined;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'TorBoxApiError';
      this.status = status;
    }
  },
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(async () => 'linux'),
}));

import { TorBoxApiError, validateApiKey } from '../../api/torbox';

const baseSettings: DownloadSettings = {
  api_key: '',
  download_dir: '/home/user/Downloads/TorBox',
  max_concurrent: 3,
  bandwidth_limit: 0,
  notify_on_complete: true,
  open_folder_on_complete: true,
  close_to_tray: true,
  color_mode: 'dark',
};

function renderWizard(props: Partial<React.ComponentProps<typeof SetupWizard>> = {}) {
  const onComplete = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  return {
    user,
    onComplete,
    ...render(
      <SetupWizard
        initialSettings={baseSettings}
        saving={false}
        error={null}
        onComplete={onComplete}
        {...props}
      />
    ),
  };
}

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts on the welcome step', () => {
    renderWizard();

    expect(screen.getByRole('heading', { name: 'TorBox' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByLabelText('Step 1 of 4')).toBeInTheDocument();
  });

  it('advances from welcome to API key', async () => {
    const { user } = renderWizard();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'API key' })).toBeInTheDocument();
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 2 of 4')).toBeInTheDocument();
  });

  it('keeps Validate disabled without a key', async () => {
    const { user } = renderWizard();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: 'Validate & continue' })).toBeDisabled();
  });

  it('advances after a successful key validation', async () => {
    const mockedValidate = vi.mocked(validateApiKey);
    mockedValidate.mockResolvedValue(undefined);

    const { user } = renderWizard();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('API key'), 'valid-key');
    await user.click(screen.getByRole('button', { name: 'Validate & continue' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Download folder' })).toBeInTheDocument();
    });

    expect(mockedValidate).toHaveBeenCalledWith('valid-key');
    expect(screen.getByLabelText('Step 3 of 4')).toBeInTheDocument();
  });

  it('shows an error and stays on the API key step when validation fails', async () => {
    const mockedValidate = vi.mocked(validateApiKey);
    mockedValidate.mockRejectedValue(new TorBoxApiError('HTTP 403: unauthorized', 403));

    const { user } = renderWizard();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('API key'), 'bad-key');
    await user.click(screen.getByRole('button', { name: 'Validate & continue' }));

    await waitFor(() => {
      expect(
        screen.getByText('Invalid API key. Check the key in your TorBox account settings.')
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'API key' })).toBeInTheDocument();
  });

  it('completes setup with the chosen key and directory', async () => {
    const mockedValidate = vi.mocked(validateApiKey);
    mockedValidate.mockResolvedValue(undefined);

    const { user, onComplete } = renderWizard();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('API key'), 'setup-key');
    await user.click(screen.getByRole('button', { name: 'Validate & continue' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Download folder' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: "You're set" })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open app' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          api_key: 'setup-key',
          download_dir: '/home/user/Downloads/TorBox',
        })
      );
    });
  });
});

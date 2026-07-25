import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../../test-utils';
import type { DownloadSettings } from '../../types/downloads';
import { SettingsModal } from './SettingsModal';

const baseSettings: DownloadSettings = {
  api_key: '',
  download_dir: '',
  max_concurrent: 3,
  bandwidth_limit: 0,
  notify_on_complete: true,
  open_folder_on_complete: true,
  close_to_tray: true,
  color_mode: 'dark',
};

function renderModal(props: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();

  return {
    user,
    onSave,
    ...render(
      <SettingsModal
        opened
        onClose={vi.fn()}
        settings={baseSettings}
        saving={false}
        saved={false}
        ready
        error={null}
        onSave={onSave}
        {...props}
      />
    ),
  };
}

describe('SettingsModal', () => {
  it('renders color mode selector', () => {
    renderModal();

    expect(screen.getByText('Color mode')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
  });

  it('keeps Save enabled after edits and saves local values', async () => {
    const { user, onSave } = renderModal();

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText('API key'), 'test-key');
    await user.click(screen.getByRole('radio', { name: 'System' }));

    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          api_key: 'test-key',
          color_mode: 'auto',
        })
      );
    });
  });

  it('does not apply parent settings changes while the modal is open', async () => {
    const { user, rerender, onSave } = renderModal();

    await user.type(screen.getByLabelText('API key'), 'draft-key');
    expect(screen.getByLabelText('API key')).toHaveValue('draft-key');

    rerender(
      <SettingsModal
        opened
        onClose={vi.fn()}
        settings={{ ...baseSettings, api_key: 'parent-key' }}
        saving={false}
        saved={false}
        ready
        error={null}
        onSave={onSave}
      />
    );

    expect(screen.getByLabelText('API key')).toHaveValue('draft-key');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('has an accessible name for the color mode control', () => {
    renderModal();

    expect(screen.getByRole('radiogroup', { name: 'Color mode' })).toBeInTheDocument();
  });

  it('has an accessible name for the download directory input', () => {
    renderModal();

    expect(screen.getByRole('textbox', { name: 'Download directory' })).toBeInTheDocument();
  });
});

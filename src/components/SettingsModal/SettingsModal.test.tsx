import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import type { DownloadSettings } from '../../types/downloads';
import { SettingsModal } from './SettingsModal';

const baseSettings: DownloadSettings = {
  api_key: '',
  download_dir: '',
  max_concurrent: 3,
  bandwidth_limit: 0,
  notify_on_complete: true,
  open_folder_on_complete: true,
  color_mode: 'dark',
};

function renderModal(props: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  const onSettingChange = vi.fn();
  const onSave = vi.fn();
  const user = userEvent.setup();

  return {
    user,
    onSettingChange,
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
        onSettingChange={onSettingChange}
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

  it('calls onSettingChange when color mode changes', async () => {
    const { user, onSettingChange } = renderModal();

    await user.click(screen.getByRole('radio', { name: 'System' }));

    expect(onSettingChange).toHaveBeenCalledWith('color_mode', 'auto');
  });
});

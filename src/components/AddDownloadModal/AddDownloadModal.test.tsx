import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { AddDownloadModal } from './AddDownloadModal';

function renderModal(props: Partial<React.ComponentProps<typeof AddDownloadModal>> = {}) {
  const user = userEvent.setup();

  return {
    user,
    onAdd: vi.fn(),
    onClose: vi.fn(),
    ...render(<AddDownloadModal opened onClose={vi.fn()} onAdd={vi.fn()} {...props} />),
  };
}

describe('AddDownloadModal', () => {
  it('shows upload zone when torrent is selected', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /upload torrent file/i })).toBeInTheDocument();
  });

  it('hides upload zone when web is selected', async () => {
    const { user } = renderModal();

    await user.click(screen.getByRole('radio', { name: /web/i }));

    expect(screen.queryByRole('button', { name: /upload torrent file/i })).not.toBeInTheDocument();
  });

  it('has an accessible name for the URL input', () => {
    renderModal();

    expect(screen.getByRole('textbox', { name: 'Magnet link' })).toBeInTheDocument();
  });

  it('has an accessible name for the download type control', () => {
    renderModal();

    expect(screen.getByRole('radiogroup', { name: 'Download type' })).toBeInTheDocument();
  });
});

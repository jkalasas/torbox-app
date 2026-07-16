import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { AddDownloadModal } from './AddDownloadModal';

function renderModal(props: Partial<React.ComponentProps<typeof AddDownloadModal>> = {}) {
  const user = userEvent.setup();
  const onAdd = vi.fn();
  const onClose = vi.fn();

  return {
    user,
    onAdd,
    onClose,
    ...render(<AddDownloadModal opened onClose={onClose} onAdd={onAdd} {...props} />),
  };
}

describe('AddDownloadModal', () => {
  it('has an accessible name for the URL input', () => {
    renderModal();

    expect(screen.getByRole('textbox', { name: 'Magnet link' })).toBeInTheDocument();
  });

  it('has an accessible name for the download type control', () => {
    renderModal();

    expect(screen.getByRole('radiogroup', { name: 'Download type' })).toBeInTheDocument();
  });

  it('awaits onAdd and keeps the modal open while loading', async () => {
    const { user, onAdd, onClose } = renderModal();
    let resolveSubmit: () => void = () => {};
    onAdd.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    await user.type(screen.getByRole('textbox', { name: 'Magnet link' }), 'magnet:test');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    resolveSubmit();
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows an inline error when onAdd rejects', async () => {
    const { user, onAdd } = renderModal();
    onAdd.mockRejectedValue(new Error('Network error'));

    await user.type(screen.getByRole('textbox', { name: 'Magnet link' }), 'magnet:test');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });
});

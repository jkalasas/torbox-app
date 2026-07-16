import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  return {
    user,
    onClose,
    onConfirm,
    ...render(
      <ConfirmDialog
        opened
        title="Remove download"
        description="Are you sure?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onClose={onClose}
        onConfirm={onConfirm}
        {...props}
      />
    ),
  };
}

describe('ConfirmDialog', () => {
  it('renders the title and description', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Remove download' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const { user, onConfirm, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the cancel button is clicked', async () => {
    const { user, onClose, onConfirm } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    renderDialog({ opened: false });

    expect(screen.queryByRole('heading', { name: 'Remove download' })).not.toBeInTheDocument();
  });

  it('disables buttons while loading', () => {
    renderDialog({ loading: true });

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

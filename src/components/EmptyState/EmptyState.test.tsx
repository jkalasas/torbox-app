import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the onboarding variant', () => {
    render(
      <EmptyState
        variant="onboarding"
        title="No downloads yet"
        description="Add a magnet link to get started."
        actionLabel="Add download"
        onAction={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'No downloads yet' })).toBeInTheDocument();
    expect(screen.getByText('Add a magnet link to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add download' })).toBeInTheDocument();
  });

  it('renders the no-matches variant with a clear filters action', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();

    render(<EmptyState variant="no-matches" onClearFilters={onClearFilters} />);

    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or status filter.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('does not render an action when no handler is provided', () => {
    render(
      <EmptyState
        variant="onboarding"
        title="No downloads yet"
        description="Add a magnet link to get started."
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

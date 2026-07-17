import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  it('renders update message with version', () => {
    render(<UpdateBanner version="1.2.3" onInstall={vi.fn()} />);
    expect(screen.getByText(/Update available: v1.2.3/)).toBeInTheDocument();
  });

  it('calls onInstall when Install clicked', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    render(<UpdateBanner version="1.0.0" onInstall={onInstall} />);
    await user.click(screen.getByRole('button', { name: /Install/i }));
    expect(onInstall).toHaveBeenCalled();
  });
});

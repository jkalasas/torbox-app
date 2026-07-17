import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../test-utils';
import { UpdateModal } from './UpdateModal';

describe('UpdateModal', () => {
  it('renders version in title when provided', () => {
    render(
      <UpdateModal
        opened
        onClose={vi.fn()}
        version="2.0.0"
        notes={null}
        progress={0}
        installing={false}
        onInstall={vi.fn()}
        onRelaunch={vi.fn()}
        error={null}
        done={false}
      />
    );
    expect(screen.getByText(/Update to v2.0.0/)).toBeInTheDocument();
  });

  it('shows install button when not installing', () => {
    render(
      <UpdateModal
        opened
        onClose={vi.fn()}
        version="1.0"
        notes={null}
        progress={0}
        installing={false}
        onInstall={vi.fn()}
        onRelaunch={vi.fn()}
        error={null}
        done={false}
      />
    );
    expect(screen.getByRole('button', { name: /Download and install/i })).toBeInTheDocument();
  });
});

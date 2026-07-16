import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { IconRail } from './IconRail';

describe('IconRail', () => {
  it('marks the active tab and fires callbacks', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onAdd = vi.fn();
    const onSettings = vi.fn();

    render(
      <IconRail activeTab="cloud" onTabChange={onTabChange} onAdd={onAdd} onSettings={onSettings} />
    );

    expect(screen.getByRole('tab', { name: 'Cloud downloads' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.click(screen.getByRole('tab', { name: 'Local transfers' }));
    expect(onTabChange).toHaveBeenCalledWith('local');

    await user.click(screen.getByRole('button', { name: 'Add download' }));
    expect(onAdd).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalled();
  });
});

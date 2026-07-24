import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '../../../test-utils';
import { DownloadRow } from './DownloadRow';

describe('DownloadRow', () => {
  it('pretty-prints content:// destination paths', () => {
    render(
      <DownloadRow
        id="local-1"
        name="movie.mkv"
        status="complete"
        progress={100}
        sizeBytes={1024}
        destinationPath="content://com.android.externalstorage.documents/tree/primary%3ADownload%2FTorBox"
      />
    );

    expect(screen.getByText('Download/TorBox')).toBeInTheDocument();
    expect(screen.queryByText(/content:\/\//)).not.toBeInTheDocument();
  });

  it('offers a local file delete option for local transfers', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <DownloadRow
        id="local-1"
        name="movie.mkv"
        status="complete"
        progress={100}
        sizeBytes={1024}
        canDeleteLocalFile
        onRemove={onRemove}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Remove movie.mkv' }));

    const checkbox = screen.getByRole('checkbox', {
      name: 'Also delete the file from this device',
    });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onRemove).toHaveBeenCalledWith('local-1', { deleteLocalFile: true });
  });

  it('does not offer local file delete for cloud downloads', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <DownloadRow
        id="cloud-1"
        name="movie.mkv"
        status="complete"
        progress={100}
        sizeBytes={1024}
        onRemove={onRemove}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Remove movie.mkv' }));

    expect(
      screen.queryByRole('checkbox', {
        name: 'Also delete the file from this device',
      })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onRemove).toHaveBeenCalledWith('cloud-1', undefined);
  });
});

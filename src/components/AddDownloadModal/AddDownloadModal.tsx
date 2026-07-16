import { Button, Input, Modal, SegmentedControl, TextInput } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';
import { useState } from 'react';
import type { CloudDownloadType } from '../../types/downloads';
import classes from './AddDownloadModal.module.css';

export interface AddDownloadModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called when the user submits. The modal awaits the returned promise (or
   *  treats a void return as resolved) and keeps the dialog open with a loading
   *  state until it resolves. Rejections are shown inline; callers should return
   *  a promise for every submit so errors can be surfaced. */
  onAdd: (name: string, type: CloudDownloadType, url: string) => void | Promise<void>;
}

const URL_INPUT_ID = 'add-download-url';

export function AddDownloadModal({ opened, onClose, onAdd }: AddDownloadModalProps) {
  const [type, setType] = useState<CloudDownloadType>('torrent');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter a magnet link or URL.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const name = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
      await onAdd(name, type, trimmed);
      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) {
      return;
    }
    setUrl('');
    setError(null);
    onClose();
  };

  const handleChange = (value: string) => {
    setUrl(value);
    if (error) {
      setError(null);
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Add download" size="sm" centered>
      <div className={classes.content}>
        <div>
          <SegmentedControl
            className={classes.typeToggle}
            value={type}
            onChange={(v) => setType(v as CloudDownloadType)}
            data={[
              { value: 'torrent', label: 'Torrent' },
              { value: 'web', label: 'Web' },
            ]}
            fullWidth
            disabled={loading}
            aria-label="Download type"
          />
        </div>

        <div>
          <Input.Label className={classes.sectionLabel} htmlFor={URL_INPUT_ID}>
            {type === 'torrent' ? 'Magnet link' : 'URL'}
          </Input.Label>
          <TextInput
            id={URL_INPUT_ID}
            className={classes.urlInput}
            placeholder={
              type === 'torrent' ? 'magnet:?xt=urn:btih:…' : 'https://example.com/file.zip'
            }
            value={url}
            onChange={(e) => handleChange(e.currentTarget.value)}
            error={error}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSubmit();
              }
            }}
            leftSection={<IconLink size={16} stroke={2} />}
            autoFocus
            aria-label={type === 'torrent' ? 'Magnet link' : 'URL'}
          />
        </div>

        <div className={classes.actions}>
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} loading={loading}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { Button, Modal, SegmentedControl, TextInput } from '@mantine/core';
import { IconFileUpload, IconLink } from '@tabler/icons-react';
import { useState } from 'react';
import type { CloudDownloadType } from '../../types/downloads';
import classes from './AddDownloadModal.module.css';

export interface AddDownloadModalProps {
  opened: boolean;
  onClose: () => void;
  onAdd: (name: string, type: CloudDownloadType, url: string) => void;
}

export function AddDownloadModal({ opened, onClose, onAdd }: AddDownloadModalProps) {
  const [type, setType] = useState<CloudDownloadType>('torrent');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter a magnet link or URL.');
      return;
    }
    setError(null);
    const name = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
    onAdd(name, type, trimmed);
    setUrl('');
  };

  const handleClose = () => {
    setUrl('');
    setError(null);
    onClose();
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
            aria-label="Download type"
          />
        </div>

        <div>
          <p className={classes.sectionLabel}>{type === 'torrent' ? 'Magnet link' : 'URL'}</p>
          <TextInput
            className={classes.urlInput}
            placeholder={
              type === 'torrent' ? 'magnet:?xt=urn:btih:…' : 'https://example.com/file.zip'
            }
            value={url}
            onChange={(e) => {
              setUrl(e.currentTarget.value);
              if (error) {
                setError(null);
              }
            }}
            error={error}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            leftSection={<IconLink size={16} stroke={2} />}
            autoFocus
            aria-label={type === 'torrent' ? 'Magnet link' : 'URL'}
          />
        </div>

        {type === 'torrent' && (
          <div>
            <p className={classes.sectionLabel}>Or upload a file</p>
            <button type="button" className={classes.dropZone} aria-label="Upload torrent file">
              <div className={classes.dropZoneIcon}>
                <IconFileUpload size={24} stroke={1.5} />
              </div>
              <p className={classes.dropZoneText}>Drop a .torrent file here or click to browse</p>
              <p className={classes.dropZoneHint}>Torrent files only (.torrent)</p>
            </button>
          </div>
        )}

        <div className={classes.actions}>
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}

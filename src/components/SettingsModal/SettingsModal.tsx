import { ActionIcon, Button, Modal, TextInput } from '@mantine/core';
import { IconCheck, IconEye, IconEyeOff, IconKey } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import classes from './SettingsModal.module.css';

export interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  savedApiKey: string;
  saving: boolean;
  saved: boolean;
  ready: boolean;
  onSave: () => Promise<void>;
  onApiKeyChange: (key: string) => void;
}

export function SettingsModal({
  opened,
  onClose,
  savedApiKey,
  saving,
  saved,
  ready,
  onSave,
  onApiKeyChange,
}: SettingsModalProps) {
  const [visible, setVisible] = useState(false);

  // Sync local input when modal opens or store loads
  const [localKey, setLocalKey] = useState('');
  useEffect(() => {
    if (opened && ready) {
      setLocalKey(savedApiKey);
    }
  }, [opened, ready, savedApiKey]);

  // Keep parent state in sync with local input
  useEffect(() => {
    onApiKeyChange(localKey);
  }, [localKey, onApiKeyChange]);

  const hasChanges = localKey !== savedApiKey;

  const handleSave = async () => {
    await onSave();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="sm" centered>
      <div className={classes.content}>
        <div className={classes.field}>
          <p className={classes.label}>API Key</p>
          <TextInput
            type={visible ? 'text' : 'password'}
            placeholder="Paste your TorBox API key"
            value={localKey}
            onChange={(e) => setLocalKey(e.currentTarget.value)}
            leftSection={<IconKey size={16} stroke={2} />}
            rightSection={
              <ActionIcon
                variant="subtle"
                size="sm"
                color="gray"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Hide API key' : 'Show API key'}
              >
                {visible ? <IconEyeOff size={16} stroke={2} /> : <IconEye size={16} stroke={2} />}
              </ActionIcon>
            }
            aria-label="API key"
          />
          <p className={classes.helpText}>Find your API key in your TorBox account settings.</p>
        </div>

        <div className={classes.actions}>
          {saved && (
            <span className={classes.savedIndicator}>
              <IconCheck size={14} stroke={2.5} />
              Saved
            </span>
          )}
          <Button onClick={handleSave} loading={saving} disabled={!hasChanges} size="compact-sm">
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

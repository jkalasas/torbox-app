import { ActionIcon, Button, TextInput, Tooltip } from '@mantine/core';
import { IconPlus, IconRefresh, IconSettings } from '@tabler/icons-react';
import classes from './DownloadToolbar.module.css';

export interface DownloadToolbarProps {
  onAdd?: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
}

export function DownloadToolbar({ onAdd, onRefresh, onSettings }: DownloadToolbarProps) {
  return (
    <div className={classes.toolbar} role="toolbar" aria-label="Download actions">
      {onAdd && (
        <Button
          className={classes.addButton}
          leftSection={<IconPlus size={16} stroke={2} />}
          onClick={onAdd}
          variant="filled"
          size="compact-sm"
        >
          Add
        </Button>
      )}

      <TextInput
        className={classes.magnetInput}
        placeholder="Paste magnet link or URL…"
        size="xs"
        aria-label="Magnet link or URL input"
      />

      {onRefresh && (
        <Tooltip label="Refresh" withArrow>
          <ActionIcon
            variant="subtle"
            size="md"
            className={classes.refreshButton}
            onClick={onRefresh}
            aria-label="Refresh downloads"
          >
            <IconRefresh size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}

      {onSettings && (
        <Tooltip label="Settings" withArrow>
          <ActionIcon
            variant="subtle"
            size="md"
            className={classes.settingsButton}
            onClick={onSettings}
            aria-label="Settings"
          >
            <IconSettings size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}
    </div>
  );
}

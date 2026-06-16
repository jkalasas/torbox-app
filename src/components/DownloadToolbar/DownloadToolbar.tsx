import { ActionIcon, Button, TextInput, Tooltip } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch, IconSettings } from '@tabler/icons-react';
import classes from './DownloadToolbar.module.css';

export interface DownloadToolbarProps {
  onAdd?: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function DownloadToolbar({
  onAdd,
  onRefresh,
  onSettings,
  searchValue = '',
  onSearchChange,
}: DownloadToolbarProps) {
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
        placeholder="Filter by name…"
        size="xs"
        value={searchValue}
        onChange={(e) => onSearchChange?.(e.currentTarget.value)}
        leftSection={<IconSearch size={14} stroke={2} />}
        aria-label="Filter downloads by name"
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

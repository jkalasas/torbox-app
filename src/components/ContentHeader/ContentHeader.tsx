import { ActionIcon, TextInput, Tooltip } from '@mantine/core';
import { IconRefresh, IconSearch, IconSettings } from '@tabler/icons-react';
import classes from './ContentHeader.module.css';

export interface ContentHeaderProps {
  title: string;
  onRefresh?: () => void;
  onSettings?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showMobileSettings?: boolean;
}

export function ContentHeader({
  title,
  onRefresh,
  onSettings,
  searchValue = '',
  onSearchChange,
  showMobileSettings = false,
}: ContentHeaderProps) {
  return (
    <header className={classes.header} data-tauri-drag-region>
      <div className={classes.titleRow} data-tauri-drag-region>
        <h1 className={classes.title} data-tauri-drag-region>
          {title}
        </h1>
        <div className={classes.actions}>
          {onRefresh && (
            <Tooltip label="Refresh" withArrow>
              <ActionIcon
                variant="subtle"
                size="md"
                className={classes.iconButton}
                onClick={onRefresh}
                aria-label="Refresh downloads"
              >
                <IconRefresh size={16} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}
          {showMobileSettings && onSettings && (
            <ActionIcon
              variant="subtle"
              size="md"
              className={`${classes.iconButton} ${classes.mobileOnly}`}
              onClick={onSettings}
              aria-label="Settings"
            >
              <IconSettings size={18} stroke={2} />
            </ActionIcon>
          )}
        </div>
      </div>

      {onSearchChange && (
        <TextInput
          className={classes.search}
          placeholder="Filter by name…"
          size="xs"
          value={searchValue}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          leftSection={<IconSearch size={14} stroke={2} />}
          aria-label="Filter downloads by name"
        />
      )}
    </header>
  );
}

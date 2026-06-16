import { ActionIcon } from '@mantine/core';
import { IconExclamationCircle, IconX } from '@tabler/icons-react';
import classes from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className={classes.banner} role="alert">
      <IconExclamationCircle
        size={16}
        stroke={2}
        className={classes.icon}
        aria-hidden="true"
      />
      <span className={classes.message}>{message}</span>
      {onDismiss && (
        <ActionIcon
          variant="subtle"
          size="md"
          className={classes.dismiss}
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <IconX size={14} stroke={2} />
        </ActionIcon>
      )}
    </div>
  );
}

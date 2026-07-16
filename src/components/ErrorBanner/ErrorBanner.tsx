import { ActionIcon, Button } from '@mantine/core';
import { IconExclamationCircle, IconX } from '@tabler/icons-react';
import classes from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <div className={classes.banner} role="alert" aria-live="assertive">
      <IconExclamationCircle size={16} stroke={2} className={classes.icon} aria-hidden="true" />
      <span className={classes.message}>{message}</span>
      <div className={classes.actions}>
        {onRetry && (
          <Button
            variant="transparent"
            size="compact-sm"
            className={classes.retry}
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
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
    </div>
  );
}

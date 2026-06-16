import { Button } from '@mantine/core';
import { IconCloudDown } from '@tabler/icons-react';
import classes from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className={classes.wrapper}>
      <div className={classes.iconWrapper} aria-hidden="true">
        <IconCloudDown size={40} stroke={1.5} />
      </div>
      <h2 className={classes.title}>{title}</h2>
      <p className={classes.description}>{description}</p>
      {onAction && (
        <Button
          className={classes.action}
          onClick={onAction}
          variant="filled"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

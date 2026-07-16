import { Button } from '@mantine/core';
import { IconCloudDown } from '@tabler/icons-react';
import classes from './EmptyState.module.css';

export type EmptyStateVariant = 'onboarding' | 'no-matches';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClearFilters?: () => void;
}

export function EmptyState({
  variant = 'onboarding',
  title,
  description,
  actionLabel,
  onAction,
  onClearFilters,
}: EmptyStateProps) {
  const isNoMatches = variant === 'no-matches';

  const displayTitle = isNoMatches ? 'No matches' : title;
  const displayDescription = isNoMatches
    ? 'Try adjusting your search or status filter.'
    : description;
  const displayActionLabel = isNoMatches ? 'Clear filters' : actionLabel;
  const displayAction = isNoMatches ? onClearFilters : onAction;

  return (
    <div className={classes.wrapper}>
      <div className={classes.iconWrapper} aria-hidden="true">
        <IconCloudDown size={44} stroke={1.5} />
      </div>
      <h2 className={classes.title}>{displayTitle}</h2>
      <p className={classes.description}>{displayDescription}</p>
      {displayAction && displayActionLabel && (
        <Button className={classes.action} onClick={displayAction} variant="filled">
          {displayActionLabel}
        </Button>
      )}
    </div>
  );
}

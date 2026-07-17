import { Button, Text } from '@mantine/core';
import { IconArrowUp } from '@tabler/icons-react';
import classes from './UpdateBanner.module.css';

export interface UpdateBannerProps {
  version: string;
  onInstall: () => void;
  releasesUrl?: string;
  onOpenReleases?: () => void;
}

export function UpdateBanner({
  version,
  onInstall,
  releasesUrl,
  onOpenReleases,
}: UpdateBannerProps) {
  const isManual = !!releasesUrl && !onInstall;

  return (
    <div className={classes.banner}>
      <Text size="sm" className={classes.message}>
        {isManual ? 'New version available on GitHub' : `Update available: v${version}`}
      </Text>
      <div className={classes.actions}>
        {isManual && releasesUrl && onOpenReleases ? (
          <Button
            variant="default"
            size="compact-sm"
            className={classes.button}
            onClick={onOpenReleases}
          >
            View releases
          </Button>
        ) : (
          <Button
            variant="filled"
            size="compact-sm"
            leftSection={<IconArrowUp size={14} stroke={2} />}
            onClick={onInstall}
            className={classes.button}
          >
            Install
          </Button>
        )}
      </div>
    </div>
  );
}

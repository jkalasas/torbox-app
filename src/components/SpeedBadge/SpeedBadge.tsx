import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { formatSpeed } from '../../utils/format';
import classes from './SpeedBadge.module.css';

export interface SpeedBadgeProps {
  downloadBytesPerSec: number;
  uploadBytesPerSec?: number;
  total: number;
  active: number;
}

export function SpeedBadge({
  downloadBytesPerSec,
  uploadBytesPerSec = 0,
  total,
  active,
}: SpeedBadgeProps) {
  if (total === 0 && downloadBytesPerSec === 0) {
    return null;
  }

  return (
    <div className={classes.badge} aria-live="polite">
      <div className={classes.meta}>
        <span className={classes.count}>{active > 0 ? `${active} active` : `${total} total`}</span>
      </div>
      <div className={classes.speeds}>
        {uploadBytesPerSec > 0 && (
          <span className={classes.speed}>
            <IconArrowUp size={12} stroke={2} aria-hidden="true" />
            {formatSpeed(uploadBytesPerSec)}
          </span>
        )}
        <span className={`${classes.speed} ${classes.download}`}>
          <IconArrowDown size={12} stroke={2} aria-hidden="true" />
          {formatSpeed(downloadBytesPerSec)}
        </span>
      </div>
    </div>
  );
}

import { ActionIcon, Tooltip } from '@mantine/core';
import {
  IconDownload,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { formatBytes, formatDuration, formatSpeed } from '../../utils/format';
import classes from './DownloadRow.module.css';

export interface DownloadRowProps {
  id: string;
  name: string;
  /** Normalized status across cloud + local */
  status: 'queued' | 'downloading' | 'cached' | 'complete' | 'error';
  progress: number; // 0–100
  sizeBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  errorMessage?: string;
  paused?: boolean;
  /** Cloud-specific */
  type?: 'torrent' | 'web';
  seeders?: number;
  peers?: number;
  /** Local-specific */
  destinationPath?: string;
  /** Callbacks */
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDownloadToDevice?: (id: string) => void;
}

function getDotClass(
  status: DownloadRowProps['status'],
  paused: boolean,
): string {
  if (paused) {
    return classes.dotPaused;
  }
  switch (status) {
    case 'downloading':
      return classes.dotDownloading;
    case 'queued':
      return classes.dotQueued;
    case 'cached':
    case 'complete':
      return classes.dotComplete;
    case 'error':
      return classes.dotError;
    default:
      return classes.dotQueued;
  }
}

function getProgressFillClass(status: DownloadRowProps['status']): string {
  switch (status) {
    case 'cached':
    case 'complete':
      return classes.progressFillComplete;
    case 'error':
      return classes.progressFillError;
    default:
      return classes.progressFill;
  }
}

export function DownloadRow({
  id,
  name,
  status,
  progress,
  sizeBytes,
  speedBytesPerSec,
  etaSeconds,
  errorMessage,
  paused = false,
  type,
  seeders,
  peers,
  destinationPath,
  onPause,
  onResume,
  onRemove,
  onRetry,
  onDownloadToDevice,
}: DownloadRowProps) {
  const isActive = status === 'downloading' && !paused;
  const isComplete = status === 'cached' || status === 'complete';
  const isError = status === 'error';

  const dotClass = getDotClass(status, paused);
  const progressFillClass = getProgressFillClass(status);

  return (
    <div className={classes.row} data-interactive>
      {/* Status dot */}
      <div className={`${classes.dot} ${dotClass}`} aria-hidden="true" />

      {/* Content */}
      <div className={classes.content}>
        {/* Top line: name + progress */}
        <div className={classes.topLine}>
          <span className={classes.name} title={name}>
            {name}
          </span>
          <div className={classes.progressWrapper}>
            <progress
              className={`${classes.progressFill} ${progressFillClass}`}
              value={Math.round(progress)}
              max={100}
              aria-label={`${name} progress: ${Math.round(progress)}%`}
            />
            <div className={classes.progressPercent}>
              {Math.round(progress)}%
            </div>
          </div>
        </div>

        {/* Metadata line */}
        <div className={classes.meta}>
          <span className={`${classes.metaItem} ${classes.metaMono}`}>
            {formatBytes(sizeBytes)}
          </span>

          {isActive && speedBytesPerSec && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={`${classes.metaItem} ${classes.metaMono}`}>
                {formatSpeed(speedBytesPerSec)}
              </span>
            </>
          )}

          {isActive && etaSeconds && etaSeconds > 0 && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.metaItem}>
                {formatDuration(etaSeconds)} left
              </span>
            </>
          )}

          {paused && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.metaItem}>Paused</span>
            </>
          )}

          {isComplete && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.metaItem}>
                {type ? 'Cached' : 'Complete'}
              </span>
            </>
          )}

          {type && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.metaItem}>
                {type === 'torrent' ? 'Torrent' : 'Web'}
              </span>
            </>
          )}

          {seeders !== undefined && peers !== undefined && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.peerInfo}>
                {seeders} seeds · {peers} peers
              </span>
            </>
          )}

          {destinationPath && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.metaItem}>{destinationPath}</span>
            </>
          )}

          {isError && errorMessage && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.errorText}>{errorMessage}</span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons (hidden until hover on desktop) */}
      <div className={classes.actions} role="toolbar" aria-label={`Actions for ${name}`}>
        {isActive && onPause && (
          <Tooltip label="Pause" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              className={classes.actionButton}
              onClick={() => onPause(id)}
              aria-label={`Pause ${name}`}
            >
              <IconPlayerPause size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}

        {paused && onResume && (
          <Tooltip label="Resume" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              className={classes.actionButton}
              onClick={() => onResume(id)}
              aria-label={`Resume ${name}`}
            >
              <IconPlayerPlay size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}

        {isError && onRetry && (
          <Tooltip label="Retry" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              className={classes.actionButton}
              onClick={() => onRetry(id)}
              aria-label={`Retry ${name}`}
            >
              <IconRefresh size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}

        {isComplete && onDownloadToDevice && (
          <Tooltip label="Download to device" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              className={classes.actionButton}
              onClick={() => onDownloadToDevice(id)}
              aria-label={`Download ${name} to device`}
            >
              <IconDownload size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}

        {onRemove && (
          <Tooltip label="Remove" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              className={`${classes.actionButton} ${classes.actionButtonDanger}`}
              onClick={() => onRemove(id)}
              aria-label={`Remove ${name}`}
            >
              <IconTrash size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

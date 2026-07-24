import { ActionIcon, Tooltip } from '@mantine/core';
import {
  IconDownload,
  IconFolder,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { formatDisplayPath } from '../../utils/fileName';
import { formatBytes, formatDuration, formatSpeed } from '../../utils/format';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import classes from './DownloadRow.module.css';

export interface DownloadRowProps {
  id: string;
  name: string;
  status: 'queued' | 'downloading' | 'cached' | 'complete' | 'error';
  progress: number;
  sizeBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  errorMessage?: string;
  paused?: boolean;
  type?: 'torrent' | 'web';
  cached?: boolean;
  seeders?: number;
  peers?: number;
  destinationPath?: string;
  canDeleteLocalFile?: boolean;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRemove?: (id: string, options?: { deleteLocalFile?: boolean }) => void;
  onRetry?: (id: string) => void;
  onDownloadToDevice?: (id: string) => void;
  onOpenFiles?: (id: string) => void;
  hasFiles?: boolean;
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

function statusLabel(
  status: DownloadRowProps['status'],
  paused: boolean,
  type?: 'torrent' | 'web',
  cached?: boolean
): string {
  if (paused) {
    return 'Paused';
  }
  switch (status) {
    case 'downloading':
      return 'Downloading';
    case 'queued':
      return 'Queued';
    case 'cached':
      return cached ? 'Already cached' : 'Cached';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
    default:
      return type === 'web' ? 'Web' : 'Torrent';
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
  cached,
  seeders,
  peers,
  destinationPath,
  canDeleteLocalFile = false,
  onPause,
  onResume,
  onRemove,
  onRetry,
  onDownloadToDevice,
  onOpenFiles,
  hasFiles,
}: DownloadRowProps) {
  const isActive = status === 'downloading' && !paused;
  const isComplete = status === 'cached' || status === 'complete';
  const isError = status === 'error';
  const progressFillClass = getProgressFillClass(status);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [deleteLocalFile, setDeleteLocalFile] = useState(false);

  const openRemoveConfirm = () => {
    setDeleteLocalFile(false);
    setRemoveConfirmOpen(true);
  };

  const closeRemoveConfirm = () => {
    setRemoveConfirmOpen(false);
    setDeleteLocalFile(false);
  };

  const downloadedBytes = Math.round((sizeBytes * Math.min(progress, 100)) / 100);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`${classes.row}${hasFiles ? ` ${classes.rowClickable}` : ''}`}
      data-interactive
      onClick={hasFiles && onOpenFiles ? () => onOpenFiles(id) : undefined}
      onKeyDown={
        hasFiles && onOpenFiles
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenFiles(id);
              }
            }
          : undefined
      }
      role={hasFiles ? 'button' : undefined}
      tabIndex={hasFiles ? 0 : undefined}
      aria-label={hasFiles ? `View files for ${name}` : undefined}
    >
      <div className={classes.topLine}>
        <span className={classes.name} title={name}>
          {name}
        </span>

        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
        <div
          className={classes.actions}
          role="toolbar"
          aria-label={`Actions for ${name}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {isActive && onPause && (
            <Tooltip label="Pause" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={classes.actionButton}
                onClick={() => onPause(id)}
                aria-label={`Pause ${name}`}
              >
                <IconPlayerPause size={14} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}

          {paused && onResume && (
            <Tooltip label="Resume" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={classes.actionButton}
                onClick={() => onResume(id)}
                aria-label={`Resume ${name}`}
              >
                <IconPlayerPlay size={14} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}

          {isError && onRetry && (
            <Tooltip label="Retry" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={classes.actionButton}
                onClick={() => onRetry(id)}
                aria-label={`Retry ${name}`}
              >
                <IconRefresh size={14} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}

          {isComplete && onDownloadToDevice && (
            <Tooltip label="Download to device" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={classes.actionButton}
                onClick={() => onDownloadToDevice(id)}
                aria-label={`Download ${name} to device`}
              >
                <IconDownload size={14} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}

          {hasFiles && onOpenFiles && (
            <Tooltip label="Files" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={classes.actionButton}
                onClick={() => onOpenFiles(id)}
                aria-label={`View files for ${name}`}
              >
                <IconFolder size={14} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}

          {onRemove && (
            <Tooltip label="Remove" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                className={`${classes.actionButton} ${classes.actionButtonDanger}`}
                onClick={openRemoveConfirm}
                aria-label={`Remove ${name}`}
              >
                <IconTrash size={14} stroke={2} />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
      </div>

      <div
        className={classes.progressTrack}
        role="progressbar"
        aria-label={`${name} progress: ${Math.round(progress)}%`}
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`${classes.progressFill} ${progressFillClass}`}
          style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }}
        />
      </div>

      <div className={classes.meta}>
        <div className={classes.metaLeft}>
          <span className={`${classes.metaItem} ${classes.metaMono}`}>
            {formatBytes(downloadedBytes)} / {formatBytes(sizeBytes)}
          </span>
          <span className={classes.metaSeparator} aria-hidden="true">
            ·
          </span>
          <span className={classes.metaItem}>{statusLabel(status, paused, type, cached)}</span>
          {isError && errorMessage && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.errorText}>{errorMessage}</span>
            </>
          )}
          {destinationPath && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.pathItem} title={destinationPath}>
                {formatDisplayPath(destinationPath)}
              </span>
            </>
          )}
        </div>

        <div className={classes.metaRight}>
          {isActive && speedBytesPerSec !== undefined && (
            <span className={`${classes.metaItem} ${classes.metaMono}`}>
              ↓ {formatSpeed(speedBytesPerSec)}
            </span>
          )}
          {isActive && etaSeconds !== undefined && etaSeconds > 0 && (
            <span className={classes.metaItem}>Remaining {formatDuration(etaSeconds)}</span>
          )}
          {seeders !== undefined && peers !== undefined && (
            <span className={classes.metaItem}>
              {seeders} seeds · {peers} peers
            </span>
          )}
        </div>
      </div>

      {onRemove && (
        <ConfirmDialog
          opened={removeConfirmOpen}
          onClose={closeRemoveConfirm}
          onConfirm={() => {
            onRemove(id, canDeleteLocalFile ? { deleteLocalFile } : undefined);
            closeRemoveConfirm();
          }}
          title="Remove download"
          description={`Are you sure you want to remove "${name}"? This action cannot be undone.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          confirmColor="red"
          checkboxLabel={canDeleteLocalFile ? 'Also delete the file from this device' : undefined}
          checkboxChecked={deleteLocalFile}
          onCheckboxChange={setDeleteLocalFile}
        />
      )}
    </div>
  );
}

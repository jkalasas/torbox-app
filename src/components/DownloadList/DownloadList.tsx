import type { CloudDownload, LocalTransfer } from '../../types/downloads';
import { DownloadRow, type DownloadRowProps } from '../DownloadRow/DownloadRow';
import { EmptyState } from '../EmptyState/EmptyState';
import classes from './DownloadList.module.css';

export interface DownloadListProps {
  /** Cloud downloads to display */
  downloads?: CloudDownload[];
  /** Local transfers to display */
  transfers?: LocalTransfer[];
  loading?: boolean;
  /** Number of skeleton rows when loading */
  skeletonCount?: number;
  /** Callbacks */
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDownloadToDevice?: (id: string) => void;
  /** For empty state */
  emptyTitle?: string;
  emptyDescription?: string;
  onAdd?: () => void;
}

function mapCloudToRow(d: CloudDownload): DownloadRowProps {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    progress: d.progress,
    sizeBytes: d.sizeBytes,
    speedBytesPerSec: d.speedBytesPerSec,
    etaSeconds: d.etaSeconds,
    errorMessage: d.errorMessage,
    paused: d.paused,
    type: d.type,
    seeders: d.seeders,
    peers: d.peers,
  };
}

function mapTransferToRow(t: LocalTransfer): DownloadRowProps {
  return {
    id: t.id,
    name: t.name,
    status: t.status === 'transferring' ? 'downloading' : t.status,
    progress: t.progress,
    sizeBytes: t.sizeBytes,
    speedBytesPerSec: t.speedBytesPerSec,
    etaSeconds: t.etaSeconds,
    errorMessage: t.errorMessage,
    destinationPath: t.destinationPath,
  };
}

export function DownloadList({
  downloads,
  transfers,
  loading = false,
  skeletonCount = 5,
  onPause,
  onResume,
  onRemove,
  onRetry,
  onDownloadToDevice,
  emptyTitle = 'No downloads yet',
  emptyDescription = 'Add a magnet link or torrent file to get started.',
  onAdd,
}: DownloadListProps) {
  if (loading) {
    return (
      <output className={classes.list} aria-label="Loading downloads" aria-live="polite">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className={classes.skeletonRow}>
            <div className={classes.skeletonDot} />
            <div className={classes.skeletonContent}>
              <div className={`${classes.skeletonLine} ${classes.skeletonLineLong}`} />
              <div className={`${classes.skeletonLine} ${classes.skeletonLineShort}`} />
            </div>
            <div className={classes.skeletonProgress} />
          </div>
        ))}
      </output>
    );
  }

  const items: DownloadRowProps[] = [
    ...(downloads ?? []).map(mapCloudToRow),
    ...(transfers ?? []).map(mapTransferToRow),
  ];

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel="Add download"
        onAction={onAdd}
      />
    );
  }

  return (
    <ul className={classes.list} aria-label="Downloads">
      {items.map((item) => (
        <li key={item.id}>
          <DownloadRow
            {...item}
            onPause={onPause}
            onResume={onResume}
            onRemove={onRemove}
            onRetry={onRetry}
            onDownloadToDevice={onDownloadToDevice}
          />
        </li>
      ))}
    </ul>
  );
}

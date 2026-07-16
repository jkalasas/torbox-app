import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { CloudDownload, LocalTransfer } from '../../types/downloads';
import { DownloadRow, type DownloadRowProps } from '../DownloadRow/DownloadRow';
import { EmptyState } from '../EmptyState/EmptyState';
import classes from './DownloadList.module.css';

export interface DownloadListProps {
  downloads?: CloudDownload[];
  transfers?: LocalTransfer[];
  loading?: boolean;
  skeletonCount?: number;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDownloadToDevice?: (id: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onAdd?: () => void;
  onOpenFiles?: (id: string) => void;
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
    cached: d.cached,
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
  onOpenFiles,
}: DownloadListProps) {
  if (loading) {
    return (
      <output className={classes.list} aria-label="Loading downloads" aria-live="polite">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className={classes.skeletonRow}>
            <div className={`${classes.skeletonLine} ${classes.skeletonLineLong}`} />
            <div className={classes.skeletonProgress} />
            <div className={`${classes.skeletonLine} ${classes.skeletonLineShort}`} />
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
    <VirtualizedList
      items={items}
      onPause={onPause}
      onResume={onResume}
      onRemove={onRemove}
      onRetry={onRetry}
      onDownloadToDevice={onDownloadToDevice}
      onOpenFiles={onOpenFiles}
    />
  );
}

function VirtualizedList({
  items,
  onPause,
  onResume,
  onRemove,
  onRetry,
  onDownloadToDevice,
  onOpenFiles,
}: {
  items: DownloadRowProps[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDownloadToDevice?: (id: string) => void;
  onOpenFiles?: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    overscan: 5,
    gap: 8,
  });

  return (
    <div ref={scrollRef} className={classes.list} aria-label="Downloads">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={classes.virtualItem}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <DownloadRow
                {...item}
                onPause={onPause}
                onResume={onResume}
                onRemove={onRemove}
                onRetry={onRetry}
                onDownloadToDevice={onDownloadToDevice}
                onOpenFiles={onOpenFiles}
                hasFiles={item.status === 'cached' || item.status === 'complete'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

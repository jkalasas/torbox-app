import { ActionIcon, Tooltip } from '@mantine/core';
import { IconCopy, IconDownload, IconFile } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { requestFileDownloadLink } from '../../api/torbox';
import type { CloudDownloadType, FileInfo } from '../../types/downloads';
import { formatBytes } from '../../utils/format';
import classes from './FileRow.module.css';

export interface FileRowProps {
  file: FileInfo;
  apiKey: string;
  downloadType: CloudDownloadType;
  downloadId: number;
  onDownload?: () => void;
}

export function FileRow({ file, apiKey, downloadType, downloadId, onDownload }: FileRowProps) {
  const [loadingLink, setLoadingLink] = useState(false);

  const handleCopyLink = useCallback(async () => {
    setLoadingLink(true);
    try {
      const link = await requestFileDownloadLink(apiKey, downloadType, downloadId, file.id);
      await navigator.clipboard.writeText(link);
    } finally {
      setLoadingLink(false);
    }
  }, [apiKey, downloadType, downloadId, file.id]);

  return (
    <div className={classes.row}>
      <div className={classes.fileIcon} aria-hidden="true">
        <IconFile size={16} stroke={1.5} />
      </div>

      <div className={classes.content}>
        <span className={classes.name} title={file.name}>
          {file.shortName ?? file.name}
        </span>
        <div className={classes.meta}>
          <span className={classes.metaMono}>{formatBytes(file.sizeBytes)}</span>
          {file.mimeType && (
            <>
              <span className={classes.metaSeparator} aria-hidden="true">
                ·
              </span>
              <span className={classes.metaItem}>{file.mimeType}</span>
            </>
          )}
          {file.infected && <span className={classes.infectedBadge}>Infected</span>}
        </div>
      </div>

      <div className={classes.actions}>
        {onDownload && (
          <Tooltip label="Download" withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              className={classes.actionButton}
              onClick={onDownload}
              aria-label={`Download ${file.shortName ?? file.name}`}
            >
              <IconDownload size={16} stroke={2} />
            </ActionIcon>
          </Tooltip>
        )}

        <Tooltip label={loadingLink ? 'Requesting link…' : 'Copy download link'} withArrow>
          <ActionIcon
            variant="subtle"
            size="md"
            className={classes.actionButton}
            onClick={handleCopyLink}
            disabled={loadingLink}
            aria-label={`Copy download link for ${file.shortName ?? file.name}`}
          >
            <IconCopy size={16} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
}

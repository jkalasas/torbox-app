import { Modal, Text } from '@mantine/core';
import type { CloudDownloadType, FileInfo } from '../../types/downloads';
import { FileRow } from '../FileRow/FileRow';
import classes from './FileListModal.module.css';

export interface FileListModalProps {
  opened: boolean;
  onClose: () => void;
  /** Name of the parent download */
  downloadName: string;
  /** Files to display */
  files: FileInfo[];
  /** API key for requesting download links */
  apiKey: string;
  /** Type of the parent download */
  downloadType: CloudDownloadType;
  /** Numeric ID of the parent download (without prefix) */
  downloadId: number;
}

export function FileListModal({
  opened,
  onClose,
  downloadName,
  files,
  apiKey,
  downloadType,
  downloadId,
}: FileListModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Files" size="md" centered>
      <div className={classes.content}>
        <Text size="sm" c="dimmed" mb="xs">
          {downloadName}
        </Text>

        <Text size="xs" c="dimmed" mb="sm" className={classes.fileCount}>
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </Text>

        <div className={classes.list}>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              apiKey={apiKey}
              downloadType={downloadType}
              downloadId={downloadId}
            />
          ))}
        </div>

        {files.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No files available
          </Text>
        )}
      </div>
    </Modal>
  );
}

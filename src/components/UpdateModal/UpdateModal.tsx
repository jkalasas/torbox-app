import { Button, Group, Modal, Progress, Text } from '@mantine/core';
import classes from './UpdateModal.module.css';

export interface UpdateModalProps {
  opened: boolean;
  onClose: () => void;
  version: string | null;
  notes: string | null;
  progress: number;
  installing: boolean;
  onInstall: () => void;
  onRelaunch: () => void;
  error: string | null;
  done: boolean;
}

export function UpdateModal({
  opened,
  onClose,
  version,
  notes,
  progress,
  installing,
  onInstall,
  onRelaunch,
  error,
  done,
}: UpdateModalProps) {
  const title = done ? 'Update installed' : version ? `Update to v${version}` : 'Update';

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size={440}>
      <div className={classes.content}>
        {notes && !done && (
          <>
            <Text size="sm" c="dimmed">
              Release notes
            </Text>
            <div className={classes.notes}>{notes}</div>
          </>
        )}

        {installing && !done && (
          <div>
            <Text size="sm" mb={4}>
              Downloading... {progress}%
            </Text>
            <Progress value={progress} className={classes.progress} />
          </div>
        )}

        {done && <Text size="sm">Update installed. Restart the app to apply it.</Text>}

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <Group className={classes.actions}>
          <Button variant="default" onClick={onClose} disabled={installing}>
            {done ? 'Close' : 'Later'}
          </Button>
          {!done && !installing && <Button onClick={onInstall}>Download and install</Button>}
          {done && <Button onClick={onRelaunch}>Restart now</Button>}
        </Group>
      </div>
    </Modal>
  );
}

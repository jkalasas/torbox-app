import {
  ActionIcon,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCheck, IconEye, IconEyeOff, IconFolder, IconKey } from '@tabler/icons-react';
import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useRef, useState } from 'react';
import type { ColorMode, DownloadSettings } from '../../types/downloads';
import classes from './SettingsModal.module.css';

export interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  settings: DownloadSettings;
  saving: boolean;
  saved: boolean;
  ready: boolean;
  error: string | null;
  onSave: (settings: DownloadSettings) => Promise<DownloadSettings | void>;
}

export function SettingsModal({
  opened,
  onClose,
  settings,
  saving,
  saved,
  ready,
  error,
  onSave,
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<DownloadSettings>(settings);
  const [initialSettings, setInitialSettings] = useState<DownloadSettings>(settings);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const isOpen = opened && ready;
    if (isOpen && !wasOpenRef.current) {
      setLocalSettings(settings);
      setInitialSettings(settings);
      setApiKeyVisible(false);
    }
    wasOpenRef.current = isOpen;
  }, [opened, ready, settings]);

  useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const update = <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(initialSettings);

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select download directory',
      });
      if (selected && typeof selected === 'string') {
        update('download_dir', selected);
      }
    } catch {
      // Dialog plugin not available (mobile/web fallback)
    }
  };

  const handleSave = async () => {
    try {
      const savedSettings = await onSave(localSettings);
      const next = savedSettings ?? localSettings;
      setLocalSettings(next);
      setInitialSettings(next);
    } catch {
      // Parent exposes the error; keep local draft editable.
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size={480} centered>
      <div className={classes.content}>
        <Text fw={600} size="sm" mb={4}>
          API Key
        </Text>
        <TextInput
          type={apiKeyVisible ? 'text' : 'password'}
          placeholder="Paste your TorBox API key"
          value={localSettings.api_key}
          onChange={(e) => update('api_key', e.currentTarget.value)}
          leftSection={<IconKey size={16} stroke={2} />}
          rightSection={
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => setApiKeyVisible((v) => !v)}
              aria-label={apiKeyVisible ? 'Hide API key' : 'Show API key'}
            >
              {apiKeyVisible ? (
                <IconEyeOff size={16} stroke={2} />
              ) : (
                <IconEye size={16} stroke={2} />
              )}
            </ActionIcon>
          }
          aria-label="API key"
          mb={4}
        />
        <Text size="xs" c="dimmed" mb="md">
          Find your API key in your TorBox account settings.
        </Text>

        <Divider mb="md" />

        <Text fw={600} size="sm" mb="md">
          Appearance
        </Text>

        <Text component="label" size="sm" fw={500} display="block" mb={6}>
          Color mode
        </Text>
        <SegmentedControl
          value={localSettings.color_mode}
          onChange={(value) => update('color_mode', value as ColorMode)}
          data={[
            { value: 'auto', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          mb="md"
          aria-label="Color mode"
        />

        <Divider mb="md" />

        <Text fw={600} size="sm" mb="md">
          Downloads
        </Text>

        <Text component="label" size="sm" fw={500} display="block" mb={2}>
          Download directory
        </Text>
        <Text size="xs" c="dimmed" mb={6}>
          Where files are saved on your device
        </Text>
        <Group gap="xs" mb="md" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            value={localSettings.download_dir}
            onChange={(e) => update('download_dir', e.currentTarget.value)}
            placeholder="~/Downloads/TorBox"
            aria-label="Download directory"
          />
          <Button
            variant="default"
            size="compact-sm"
            onClick={handleBrowse}
            leftSection={<IconFolder size={14} />}
          >
            Browse
          </Button>
        </Group>

        <NumberInput
          label="Max concurrent downloads"
          description="How many files to download at once"
          value={localSettings.max_concurrent}
          onChange={(v) => update('max_concurrent', Number(v) || 1)}
          min={1}
          max={10}
          mb="md"
        />

        <NumberInput
          label="Global bandwidth limit"
          description="Cap total download speed. 0 = unlimited"
          value={localSettings.bandwidth_limit}
          onChange={(v) => update('bandwidth_limit', Number(v) || 0)}
          min={0}
          suffix=" KB/s"
          mb="md"
        />

        <Text size="sm" fw={500} mb="xs">
          When download completes
        </Text>
        <Checkbox
          label="Show notification"
          checked={localSettings.notify_on_complete}
          onChange={(e) => update('notify_on_complete', e.currentTarget.checked)}
          mb="xs"
        />
        <Checkbox
          label="Open destination folder"
          checked={localSettings.open_folder_on_complete}
          onChange={(e) => update('open_folder_on_complete', e.currentTarget.checked)}
          mb="md"
        />

        <Divider mb="md" />

        <Text fw={600} size="sm" mb={4}>
          About
        </Text>
        <Text size="xs" c="dimmed" mb={2}>
          Version {appVersion || '—'}
        </Text>
        <Button
          variant="subtle"
          size="compact-sm"
          p={0}
          onClick={() => window.open('https://github.com/jkalasas/torbox-app/releases', '_blank')}
          style={{ height: 'auto' }}
        >
          View releases on GitHub
        </Button>

        {error && (
          <Text size="xs" c="red" mb="md">
            {error}
          </Text>
        )}

        <Group justify="flex-end" align="center">
          {saved && (
            <Group gap={4}>
              <IconCheck size={14} stroke={2.5} />
              <Text size="xs" c="green">
                Saved
              </Text>
            </Group>
          )}
          <Button
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!hasChanges}
            size="compact-sm"
          >
            Save
          </Button>
        </Group>
      </div>
    </Modal>
  );
}

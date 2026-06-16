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
import { useEffect, useState } from 'react';
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
  onSettingChange: <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => void;
  onSave: () => Promise<void>;
}

export function SettingsModal({
  opened,
  onClose,
  settings,
  saving,
  saved,
  ready,
  error,
  onSettingChange,
  onSave,
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<DownloadSettings>(settings);
  const [initialSettings, setInitialSettings] = useState<DownloadSettings>(settings);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Sync local state when modal opens
  useEffect(() => {
    if (opened && ready) {
      setLocalSettings(settings);
      setInitialSettings(settings);
    }
  }, [opened, ready, settings]);

  // Push local changes up to parent for save tracking
  const update = <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    onSettingChange(key, value);
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

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="sm" centered>
      <div className={classes.content}>
        {/* API Key section */}
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

        {/* Appearance section */}
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

        {/* Downloads section */}
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
          <Button onClick={onSave} loading={saving} disabled={!hasChanges} size="compact-sm">
            Save
          </Button>
        </Group>
      </div>
    </Modal>
  );
}

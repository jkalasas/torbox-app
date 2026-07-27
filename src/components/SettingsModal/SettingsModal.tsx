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
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import type { ColorMode, DownloadSettings } from '../../types/downloads';
import {
  getBackgroundStatus,
  requestBackgroundPermissions,
  type BackgroundStatus,
} from '../../utils/backgroundDownloads';
import { openExternalUrl } from '../../utils/openExternal';
import classes from './SettingsModal.module.css';

type AppPlatform = 'linux' | 'macos' | 'windows' | 'android' | 'ios' | 'unknown';

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

function isContentUri(value: string): boolean {
  return value.startsWith('content://');
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
  const [platform, setPlatform] = useState<AppPlatform>('unknown');
  const [folderLabel, setFolderLabel] = useState<string>('');
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus | null>(null);
  const [requestingBackground, setRequestingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    void import('@tauri-apps/plugin-os')
      .then(({ platform: getPlatform }) => getPlatform())
      .then((value) => setPlatform(value as AppPlatform))
      .catch(() => setPlatform('unknown'));
  }, []);

  useEffect(() => {
    const isOpen = opened && ready;
    if (isOpen && !wasOpenRef.current) {
      setLocalSettings(settings);
      setInitialSettings(settings);
      setApiKeyVisible(false);
      setBrowseError(null);
    }
    wasOpenRef.current = isOpen;
  }, [opened, ready, settings]);

  useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!opened || platform !== 'android') {
      return;
    }
    let cancelled = false;
    void getBackgroundStatus().then((status) => {
      if (!cancelled) {
        setBackgroundStatus(status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opened, platform]);

  useEffect(() => {
    let cancelled = false;

    const resolveLabel = async () => {
      const dir = localSettings.download_dir;
      if (!dir) {
        setFolderLabel('');
        return;
      }
      if (!isContentUri(dir)) {
        setFolderLabel(dir);
        return;
      }
      try {
        const name = await invoke<string>('get_folder_display_name', { uri: dir });
        if (!cancelled) {
          setFolderLabel(name || dir);
        }
      } catch {
        if (!cancelled) {
          setFolderLabel(dir);
        }
      }
    };

    void resolveLabel();
    return () => {
      cancelled = true;
    };
  }, [localSettings.download_dir]);

  const update = <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(initialSettings);
  const isAndroid = platform === 'android';
  const isIOS = platform === 'ios';
  const isMobile = isAndroid || isIOS;
  const isDesktop = platform === 'linux' || platform === 'macos' || platform === 'windows';

  const handleBrowse = async () => {
    setBrowseError(null);
    setBrowsing(true);
    try {
      if (isAndroid) {
        const selected = await invoke<{ uri: string; name: string }>('pick_download_folder');
        update('download_dir', selected.uri);
        setFolderLabel(selected.name);
        return;
      }

      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select download directory',
      });
      if (selected && typeof selected === 'string') {
        update('download_dir', selected);
        setFolderLabel(selected);
      }
    } catch (err) {
      const raw =
        typeof err === 'string'
          ? err
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : String(err);
      if (raw.toLowerCase().includes('cancel')) {
        return;
      }
      if (isAndroid) {
        const cleaned = raw
          .replace(/^Error:\s*/i, '')
          .replace(/^.*pick_download_folder[:\s]*/i, '')
          .trim();
        setBrowseError(
          cleaned ||
            'Could not use that folder. Pick Downloads or a folder you created — Android blocks storage root.'
        );
      } else {
        setBrowseError('Could not open the folder picker.');
      }
    } finally {
      setBrowsing(false);
    }
  };

  const handleUseAppStorage = () => {
    setBrowseError(null);
    update('download_dir', '');
    setFolderLabel('App storage (default)');
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

  const directoryDescription = isAndroid
    ? 'Choose Downloads or a subfolder you created. Android will reject storage root (“Can’t use this folder”). Files are copied there when a transfer finishes.'
    : isIOS
      ? 'Files are saved in this app’s Documents storage on iOS.'
      : 'Where files are saved on your device';

  const directoryValue = isAndroid
    ? folderLabel || (localSettings.download_dir ? 'Selected folder' : 'App storage (default)')
    : localSettings.download_dir;

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
          {directoryDescription}
        </Text>
        <Group gap="xs" mb={isAndroid ? 'xs' : 'md'} wrap="nowrap" align="center">
          <TextInput
            style={{ flex: 1 }}
            value={directoryValue}
            onChange={isDesktop ? (e) => update('download_dir', e.currentTarget.value) : undefined}
            readOnly={isMobile || platform === 'unknown'}
            placeholder={isAndroid ? 'App storage (default)' : '~/Downloads/TorBox'}
            aria-label="Download directory"
          />
          {!isIOS && (
            <Button
              variant="default"
              onClick={() => void handleBrowse()}
              loading={browsing}
              leftSection={<IconFolder size={16} stroke={2} />}
            >
              {isAndroid ? 'Choose' : 'Browse'}
            </Button>
          )}
        </Group>
        {isAndroid && (
          <Group gap="xs" mb="md">
            <Button variant="subtle" size="compact-xs" onClick={handleUseAppStorage}>
              Use app storage
            </Button>
          </Group>
        )}
        {browseError && (
          <Text size="xs" c="red" mb="md">
            {browseError}
          </Text>
        )}

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
        {isDesktop && (
          <Checkbox
            label="Open destination folder"
            checked={localSettings.open_folder_on_complete}
            onChange={(e) => update('open_folder_on_complete', e.currentTarget.checked)}
            mb="xs"
          />
        )}
        {isDesktop && (
          <Checkbox
            label="Close to system tray"
            description="Keep TorBox running in the background when the window is closed"
            checked={localSettings.close_to_tray}
            onChange={(e) => update('close_to_tray', e.currentTarget.checked)}
            mb="md"
          />
        )}
        {isMobile && <div style={{ marginBottom: 'var(--mantine-spacing-md)' }} />}

        {isAndroid && (
          <>
            <Text size="sm" fw={500} mb="xs">
              Background downloads
            </Text>
            <Text size="xs" c="dimmed" mb="xs">
              Android needs notification access and unrestricted battery use so transfers continue
              when TorBox is in the background.
            </Text>
            {backgroundStatus && (
              <Text size="xs" c="dimmed" mb="xs">
                Notifications: {backgroundStatus.notificationsGranted ? 'allowed' : 'not allowed'} ·
                Battery: {backgroundStatus.batteryUnrestricted ? 'unrestricted' : 'optimized'}
              </Text>
            )}
            {backgroundError && (
              <Text size="xs" c="red" mb="xs">
                {backgroundError}
              </Text>
            )}
            <Button
              variant="light"
              size="xs"
              mb="md"
              loading={requestingBackground}
              onClick={() => {
                setBackgroundError(null);
                setRequestingBackground(true);
                void requestBackgroundPermissions()
                  .then((status) => {
                    setBackgroundStatus(status);
                    if (!status) {
                      setBackgroundError('Could not update background download permissions.');
                    }
                  })
                  .catch((err) => {
                    const message =
                      err instanceof Error
                        ? err.message
                        : typeof err === 'string'
                          ? err
                          : 'Could not request background permissions.';
                    setBackgroundError(message);
                  })
                  .finally(() => setRequestingBackground(false));
              }}
            >
              Enable background downloads
            </Button>
          </>
        )}

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
          onClick={() => void openExternalUrl('https://github.com/jkalasas/torbox-app/releases')}
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

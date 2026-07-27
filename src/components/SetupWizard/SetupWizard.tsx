import { ActionIcon, Button, Group, Text, TextInput } from '@mantine/core';
import {
  IconCheck,
  IconCloudDown,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconKey,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import { TorBoxApiError, validateApiKey } from '../../api/torbox';
import type { DownloadSettings } from '../../types/downloads';
import {
  getBackgroundStatus,
  isBackgroundReady,
  requestBackgroundPermissions,
  type BackgroundStatus,
} from '../../utils/backgroundDownloads';
import { openExternalUrl } from '../../utils/openExternal';
import { showCustomWindowControls } from '../../utils/platform';
import { WindowControls } from '../WindowControls/WindowControls';
import classes from './SetupWizard.module.css';

type AppPlatform = 'linux' | 'macos' | 'windows' | 'android' | 'ios' | 'unknown';
type WizardStepId = 'welcome' | 'api' | 'folder' | 'background' | 'done';

const TORBOX_SETTINGS_URL = 'https://torbox.app/settings';

export interface SetupWizardProps {
  initialSettings: DownloadSettings;
  saving: boolean;
  error: string | null;
  onComplete: (settings: DownloadSettings) => Promise<DownloadSettings | void>;
}

function isContentUri(value: string): boolean {
  return value.startsWith('content://');
}

function authErrorMessage(err: unknown): string {
  if (err instanceof TorBoxApiError) {
    if (err.status === 401 || err.status === 403) {
      return 'Invalid API key. Check the key in your TorBox account settings.';
    }
    if (err.status === 400) {
      return 'Enter your TorBox API key to continue.';
    }
    return err.message || 'Could not verify API key.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Could not reach TorBox. Check your connection and try again.';
}

function wizardSteps(isAndroid: boolean): WizardStepId[] {
  if (isAndroid) {
    return ['welcome', 'api', 'folder', 'background', 'done'];
  }
  return ['welcome', 'api', 'folder', 'done'];
}

export function SetupWizard({ initialSettings, saving, error, onComplete }: SetupWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [apiKey, setApiKey] = useState(initialSettings.api_key);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [downloadDir, setDownloadDir] = useState(initialSettings.download_dir);
  const [folderLabel, setFolderLabel] = useState('');
  const [platform, setPlatform] = useState<AppPlatform>('unknown');
  const [validating, setValidating] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundStatus | null>(null);
  const [requestingBackground, setRequestingBackground] = useState(false);
  const customControls = showCustomWindowControls();

  useEffect(() => {
    void import('@tauri-apps/plugin-os')
      .then(({ platform: getPlatform }) => getPlatform())
      .then((value) => setPlatform(value as AppPlatform))
      .catch(() => setPlatform('unknown'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveLabel = async () => {
      if (!downloadDir) {
        setFolderLabel('');
        return;
      }
      if (!isContentUri(downloadDir)) {
        setFolderLabel(downloadDir);
        return;
      }
      try {
        const name = await invoke<string>('get_folder_display_name', { uri: downloadDir });
        if (!cancelled) {
          setFolderLabel(name || downloadDir);
        }
      } catch {
        if (!cancelled) {
          setFolderLabel(downloadDir);
        }
      }
    };

    void resolveLabel();
    return () => {
      cancelled = true;
    };
  }, [downloadDir]);

  const isAndroid = platform === 'android';
  const isIOS = platform === 'ios';
  const isMobile = isAndroid || isIOS;
  const isDesktop = platform === 'linux' || platform === 'macos' || platform === 'windows';
  const steps = useMemo(() => wizardSteps(isAndroid), [isAndroid]);
  const step = steps[Math.min(stepIndex, steps.length - 1)] ?? 'welcome';

  useEffect(() => {
    if (step !== 'background') {
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
  }, [step]);

  useEffect(() => {
    setStepIndex((current) => Math.min(current, steps.length - 1));
  }, [steps.length]);

  const goTo = (next: WizardStepId) => {
    const index = steps.indexOf(next);
    if (index >= 0) {
      setStepIndex(index);
    }
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };

  const handleBrowse = async () => {
    setBrowseError(null);
    setBrowsing(true);
    try {
      if (isAndroid) {
        const selected = await invoke<{ uri: string; name: string }>('pick_download_folder');
        setDownloadDir(selected.uri);
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
        setDownloadDir(selected);
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
    setDownloadDir('');
    setFolderLabel('App storage (default)');
  };

  const handleValidateKey = async () => {
    setStepError(null);
    setValidating(true);
    try {
      await validateApiKey(apiKey);
      goTo('folder');
    } catch (err) {
      setStepError(authErrorMessage(err));
    } finally {
      setValidating(false);
    }
  };

  const handleEnableBackground = async () => {
    setStepError(null);
    setRequestingBackground(true);
    try {
      const status = await requestBackgroundPermissions();
      setBackgroundStatus(status);
      if (!status) {
        setStepError('Could not update background download permissions.');
      }
    } catch (err) {
      setStepError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequestingBackground(false);
    }
  };

  const handleFinish = async () => {
    setStepError(null);
    try {
      await onComplete({
        ...initialSettings,
        api_key: apiKey.trim(),
        download_dir: downloadDir.trim(),
      });
    } catch (err) {
      setStepError(err instanceof Error ? err.message : String(err));
    }
  };

  const directoryDescription = isAndroid
    ? 'Choose Downloads or a subfolder you created. Files are copied there when a transfer finishes.'
    : isIOS
      ? 'Files are saved in this app’s Documents storage on iOS.'
      : 'Where files are saved on your device. You can change this later in Settings.';

  const directoryValue = isAndroid
    ? folderLabel || (downloadDir ? 'Selected folder' : 'App storage (default)')
    : downloadDir;

  const displayError = stepError || (step === 'done' ? error : null);
  const backgroundReady = isBackgroundReady(backgroundStatus);

  return (
    <div className={classes.shell}>
      {customControls && (
        <div className={classes.titleBar} data-tauri-drag-region>
          <div className={classes.titleBarSpacer} data-tauri-drag-region />
          <WindowControls />
        </div>
      )}

      <div className={classes.body}>
        <div className={classes.panel}>
          <div className={classes.steps} aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
            {steps.map((id, index) => (
              <span
                key={id}
                className={[
                  classes.stepDot,
                  index === stepIndex ? classes.stepDotActive : '',
                  index < stepIndex ? classes.stepDotDone : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
            ))}
          </div>

          {step === 'welcome' && (
            <>
              <div className={classes.iconWrapper} aria-hidden="true">
                <IconCloudDown size={40} stroke={1.5} />
              </div>
              <h1 className={classes.title}>TorBox</h1>
              <p className={classes.description}>
                Manage cloud torrents and web downloads on this device. A few steps and you&apos;re
                ready.
              </p>
              <div className={`${classes.actions} ${classes.actionsSingle}`}>
                <Button onClick={() => goTo('api')}>Continue</Button>
              </div>
            </>
          )}

          {step === 'api' && (
            <>
              <div className={classes.iconWrapper} aria-hidden="true">
                <IconKey size={36} stroke={1.5} />
              </div>
              <h1 className={classes.title}>API key</h1>
              <p className={classes.description}>
                Paste the API key from your TorBox account. It stays on this device.
              </p>
              <TextInput
                className={classes.field}
                type={apiKeyVisible ? 'text' : 'password'}
                placeholder="Paste your TorBox API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.currentTarget.value)}
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
                autoFocus
              />
              <div className={classes.linkRow}>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  p={0}
                  onClick={() => void openExternalUrl(TORBOX_SETTINGS_URL)}
                  style={{ height: 'auto' }}
                >
                  Open TorBox settings
                </Button>
              </div>
              {displayError && <p className={classes.error}>{displayError}</p>}
              <div className={classes.actions}>
                <Button variant="default" onClick={goBack} disabled={validating}>
                  Back
                </Button>
                <Button
                  onClick={() => void handleValidateKey()}
                  loading={validating}
                  disabled={!apiKey.trim()}
                >
                  Validate & continue
                </Button>
              </div>
            </>
          )}

          {step === 'folder' && (
            <>
              <div className={classes.iconWrapper} aria-hidden="true">
                <IconFolder size={36} stroke={1.5} />
              </div>
              <h1 className={classes.title}>Download folder</h1>
              <p className={classes.description}>{directoryDescription}</p>
              <Text component="label" size="sm" fw={500} display="block" mb={6}>
                Download directory
              </Text>
              <Group gap="xs" mb={isAndroid ? 'xs' : 'md'} wrap="nowrap" align="center">
                <TextInput
                  style={{ flex: 1 }}
                  value={directoryValue}
                  onChange={isDesktop ? (e) => setDownloadDir(e.currentTarget.value) : undefined}
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
              {browseError && <p className={classes.error}>{browseError}</p>}
              <div className={classes.actions}>
                <Button variant="default" onClick={goBack}>
                  Back
                </Button>
                <Button onClick={goNext}>Continue</Button>
              </div>
            </>
          )}

          {step === 'background' && (
            <>
              <div className={classes.iconWrapper} aria-hidden="true">
                <IconPlayerPlay size={36} stroke={1.5} />
              </div>
              <h1 className={classes.title}>Background downloads</h1>
              <p className={classes.description}>
                Android needs notification access and unrestricted battery use so transfers keep
                going when TorBox is in the background.
              </p>
              {backgroundStatus && (
                <p className={classes.statusLine}>
                  Notifications: {backgroundStatus.notificationsGranted ? 'allowed' : 'not allowed'}{' '}
                  · Battery: {backgroundStatus.batteryUnrestricted ? 'unrestricted' : 'optimized'}
                </p>
              )}
              {backgroundReady ? (
                <p className={classes.readyLine}>Background downloads are enabled.</p>
              ) : (
                <div className={classes.field}>
                  <Button
                    variant="light"
                    fullWidth
                    loading={requestingBackground}
                    onClick={() => void handleEnableBackground()}
                  >
                    Enable background downloads
                  </Button>
                </div>
              )}
              {displayError && <p className={classes.error}>{displayError}</p>}
              <div className={classes.actions}>
                <Button variant="default" onClick={goBack} disabled={requestingBackground}>
                  Back
                </Button>
                <Button onClick={goNext} disabled={requestingBackground}>
                  {backgroundReady ? 'Continue' : 'Skip for now'}
                </Button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <div className={classes.iconWrapper} aria-hidden="true">
                <IconCheck size={36} stroke={1.5} />
              </div>
              <h1 className={classes.title}>You&apos;re set</h1>
              <p className={classes.description}>
                API key saved on this device. Add a magnet or web link whenever you&apos;re ready.
              </p>
              {displayError && <p className={classes.error}>{displayError}</p>}
              <div className={classes.actions}>
                <Button variant="default" onClick={goBack} disabled={saving}>
                  Back
                </Button>
                <Button onClick={() => void handleFinish()} loading={saving}>
                  Open app
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

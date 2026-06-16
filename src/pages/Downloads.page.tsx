import { ActionIcon, Text } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { AddDownloadModal } from '../components/AddDownloadModal/AddDownloadModal';
import { DownloadList } from '../components/DownloadList/DownloadList';
import { DownloadTabs } from '../components/DownloadTabs/DownloadTabs';
import { DownloadToolbar } from '../components/DownloadToolbar/DownloadToolbar';
import { ErrorBanner } from '../components/ErrorBanner/ErrorBanner';
import { SettingsModal } from '../components/SettingsModal/SettingsModal';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { useDownloads } from '../hooks/useDownloads';
import { useLocalTransfers } from '../hooks/useLocalTransfers';
import { useSettings } from '../hooks/useSettings';
import type { CloudSubTab, DownloadTab } from '../types/downloads';
import classes from './Downloads.module.css';

export function DownloadsPage() {
  const [activeTab, setActiveTab] = useState<DownloadTab>('cloud');
  const [cloudSubTab, setCloudSubTab] = useState<CloudSubTab>('torrents');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  const { savedApiKey, setApiKey, saveApiKey, saving, saved, ready } = useSettings();

  const settingsReady = ready && savedApiKey.length > 0;

  const {
    downloads,
    loading: cloudLoading,
    error: cloudError,
    addDownload,
    pauseDownload,
    resumeDownload,
    removeDownload,
    retryDownload,
    refresh: refreshCloud,
    byType,
    counts: cloudCounts,
  } = useDownloads(savedApiKey);

  const {
    transfers,
    loading: localLoading,
    error: localError,
    startTransfer,
    removeTransfer,
    retryTransfer,
    refresh: refreshLocal,
    counts: localCounts,
  } = useLocalTransfers();

  const handleRefresh = useCallback(() => {
    if (activeTab === 'cloud') {
      void refreshCloud();
    } else {
      void refreshLocal();
    }
  }, [activeTab, refreshCloud, refreshLocal]);

  const handleDownloadToDevice = useCallback(
    (id: string) => {
      const download = downloads.find((d) => d.id === id);
      if (download) {
        startTransfer(download.id, download.name, download.sizeBytes);
        setActiveTab('local');
      }
    },
    [downloads, startTransfer]
  );

  // Filter cloud downloads by sub-tab
  const filteredDownloads =
    activeTab === 'cloud' ? byType(cloudSubTab === 'torrents' ? 'torrent' : 'web') : undefined;

  const filteredTransfers = activeTab === 'local' ? transfers : undefined;

  const loading = activeTab === 'cloud' ? cloudLoading : localLoading;

  // Determine error to show (cloud or local, unless dismissed)
  const activeError = activeTab === 'cloud' ? cloudError : localError;
  const errorKey = activeTab === 'cloud' ? 'cloud-error' : 'local-error';
  const showError = activeError !== null && !dismissedErrors.has(errorKey);

  // Counts for the status bar
  const statusCounts =
    activeTab === 'cloud'
      ? { total: cloudCounts.total, active: cloudCounts.active, error: cloudCounts.error }
      : { total: localCounts.total, active: localCounts.active, error: localCounts.error };

  return (
    <div className={classes.page}>
      {/* Mobile header (visible only on small screens) */}
      <header className={classes.mobileHeader}>
        <Text fw={600} size="sm">
          TorBox
        </Text>
        <ActionIcon
          variant="subtle"
          size="md"
          color="gray"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <IconSettings size={18} stroke={2} />
        </ActionIcon>
      </header>

      {/* Toolbar */}
      <DownloadToolbar
        onAdd={() => setAddModalOpen(true)}
        onRefresh={handleRefresh}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* Tabs */}
      <DownloadTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cloudSubTab={cloudSubTab}
        onCloudSubTabChange={setCloudSubTab}
        cloudCount={cloudCounts.total}
        localCount={localCounts.total}
        torrentCount={cloudCounts.torrents}
        webCount={cloudCounts.web}
        showSubTabs={activeTab === 'cloud'}
      />

      {/* Error banner */}
      {showError && (
        <ErrorBanner
          message={activeError!}
          onDismiss={() => setDismissedErrors((prev) => new Set(prev).add(errorKey))}
        />
      )}

      {/* Download list */}
      <DownloadList
        downloads={filteredDownloads}
        transfers={filteredTransfers}
        loading={loading}
        onPause={pauseDownload}
        onResume={resumeDownload}
        onRemove={activeTab === 'cloud' ? removeDownload : removeTransfer}
        onRetry={activeTab === 'cloud' ? retryDownload : retryTransfer}
        onDownloadToDevice={activeTab === 'cloud' ? handleDownloadToDevice : undefined}
        emptyTitle={
          activeTab === 'cloud'
            ? settingsReady
              ? 'No cloud downloads yet'
              : 'API key required'
            : 'No local transfers yet'
        }
        emptyDescription={
          activeTab === 'cloud'
            ? settingsReady
              ? 'Add a magnet link or torrent file to start downloading on TorBox.'
              : 'Set your TorBox API key in Settings to get started.'
            : 'Download cached files from TorBox to your device.'
        }
        onAdd={
          activeTab === 'cloud' && !settingsReady
            ? () => setSettingsOpen(true)
            : () => setAddModalOpen(true)
        }
      />

      {/* Status bar */}
      <StatusBar
        activeTab={activeTab}
        total={statusCounts.total}
        active={statusCounts.active}
        error={statusCounts.error}
      />

      {/* Add download modal */}
      <AddDownloadModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={(name, type, url) => {
          if (!savedApiKey) {
            setAddModalOpen(false);
            setSettingsOpen(true);
            return;
          }
          void addDownload(name, type, url);
        }}
      />

      {/* Settings modal */}
      <SettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        savedApiKey={savedApiKey}
        saving={saving}
        saved={saved}
        ready={ready}
        onSave={saveApiKey}
        onApiKeyChange={setApiKey}
      />
    </div>
  );
}

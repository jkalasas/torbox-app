import { ActionIcon, SegmentedControl, Text } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { AddDownloadModal } from '../components/AddDownloadModal/AddDownloadModal';
import { DownloadList } from '../components/DownloadList/DownloadList';
import { DownloadTabs } from '../components/DownloadTabs/DownloadTabs';
import { DownloadToolbar } from '../components/DownloadToolbar/DownloadToolbar';
import { ErrorBanner } from '../components/ErrorBanner/ErrorBanner';
import { FileListModal } from '../components/FileListModal/FileListModal';
import { SettingsModal } from '../components/SettingsModal/SettingsModal';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { useDownloads } from '../hooks/useDownloads';
import { useLocalTransfers } from '../hooks/useLocalTransfers';
import { useSettings } from '../hooks/useSettings';
import type {
  CloudDownload,
  CloudDownloadStatus,
  CloudSubTab,
  DownloadTab,
  LocalTransferStatus,
} from '../types/downloads';
import classes from './Downloads.module.css';

export function DownloadsPage() {
  const [activeTab, setActiveTab] = useState<DownloadTab>('cloud');
  const [cloudSubTab, setCloudSubTab] = useState<CloudSubTab>('torrents');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    CloudDownloadStatus | LocalTransferStatus | 'all'
  >('all');
  const [fileListDownload, setFileListDownload] = useState<CloudDownload | null>(null);

  const { settings, updateSetting, saveSettings, saving, saved, ready } = useSettings();

  const settingsReady = ready && settings.api_key.length > 0;

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
  } = useDownloads(settings.api_key);

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

  // Filter cloud downloads by sub-tab, name search, and status
  const filteredDownloads = useMemo(() => {
    if (activeTab !== 'cloud') {
      return undefined;
    }

    let result = byType(cloudSubTab === 'torrents' ? 'torrent' : 'web');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    return result;
  }, [activeTab, cloudSubTab, searchQuery, statusFilter, byType]);

  const filteredTransfers = useMemo(() => {
    if (activeTab !== 'local') {
      return undefined;
    }

    let result = transfers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    return result;
  }, [activeTab, searchQuery, statusFilter, transfers]);

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
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Tabs */}
      <DownloadTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setStatusFilter('all');
        }}
        cloudSubTab={cloudSubTab}
        onCloudSubTabChange={setCloudSubTab}
        cloudCount={cloudCounts.total}
        localCount={localCounts.total}
        torrentCount={cloudCounts.torrents}
        webCount={cloudCounts.web}
        showSubTabs={activeTab === 'cloud'}
      />

      {/* Status filter */}
      <div className={classes.filterBar}>
        <SegmentedControl
          size="xs"
          value={statusFilter}
          onChange={(value) =>
            setStatusFilter(value as CloudDownloadStatus | LocalTransferStatus | 'all')
          }
          data={
            activeTab === 'cloud'
              ? [
                  { value: 'all', label: 'All' },
                  { value: 'downloading', label: 'Downloading' },
                  { value: 'queued', label: 'Queued' },
                  { value: 'cached', label: 'Cached' },
                  { value: 'error', label: 'Error' },
                ]
              : [
                  { value: 'all', label: 'All' },
                  { value: 'transferring', label: 'Transferring' },
                  { value: 'complete', label: 'Complete' },
                  { value: 'error', label: 'Error' },
                ]
          }
        />
      </div>

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
        onOpenFiles={(id) => {
          const download = downloads.find((d) => d.id === id);
          if (download && download.files.length > 0) {
            setFileListDownload(download);
          }
        }}
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
          if (!settings.api_key) {
            setAddModalOpen(false);
            setSettingsOpen(true);
            return;
          }
          setAddModalOpen(false);
          void addDownload(name, type, url);
        }}
      />

      {/* File list modal */}
      <FileListModal
        opened={fileListDownload !== null}
        onClose={() => setFileListDownload(null)}
        downloadName={fileListDownload?.name ?? ''}
        files={fileListDownload?.files ?? []}
        apiKey={settings.api_key}
        downloadType={fileListDownload?.type ?? 'torrent'}
        downloadId={fileListDownload ? Number(fileListDownload.id.slice(2)) : 0}
      />

      {/* Settings modal */}
      <SettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        savedApiKey={settings.api_key}
        saving={saving}
        saved={saved}
        ready={ready}
        onSave={saveSettings}
        onApiKeyChange={(key) => updateSetting('api_key', key)}
      />
    </div>
  );
}

import { Button } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { AddDownloadModal } from '../components/AddDownloadModal/AddDownloadModal';
import { AppShell } from '../components/AppShell/AppShell';
import { ContentHeader } from '../components/ContentHeader/ContentHeader';
import { DownloadList } from '../components/DownloadList/DownloadList';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner/ErrorBanner';
import { FileListModal } from '../components/FileListModal/FileListModal';
import { IconRail } from '../components/IconRail/IconRail';
import { MobileFilters } from '../components/MobileFilters/MobileFilters';
import { SettingsModal } from '../components/SettingsModal/SettingsModal';
import { SideNav, type StatusFilter } from '../components/SideNav/SideNav';
import { SpeedBadge } from '../components/SpeedBadge/SpeedBadge';
import { useDownloads } from '../hooks/useDownloads';
import { useLocalTransfers } from '../hooks/useLocalTransfers';
import { useSettings } from '../hooks/useSettings';
import type { CloudDownload, CloudSubTab, DownloadTab } from '../types/downloads';
import classes from './Downloads.module.css';

function parseNumericId(id: string): number {
  const numeric = id.replace(/^\D+/, '');
  return Number(numeric);
}

function filterTitle(
  activeTab: DownloadTab,
  statusFilter: StatusFilter,
  cloudSubTab: CloudSubTab
): string {
  if (activeTab === 'local') {
    switch (statusFilter) {
      case 'transferring':
        return 'Transferring';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return 'Local transfers';
    }
  }

  const typeLabel = cloudSubTab === 'torrents' ? 'Torrents' : 'Web downloads';
  switch (statusFilter) {
    case 'active':
      return `Active · ${typeLabel}`;
    case 'inactive':
      return `Inactive · ${typeLabel}`;
    case 'error':
      return `Error · ${typeLabel}`;
    default:
      return typeLabel;
  }
}

export function DownloadsPage() {
  const [activeTab, setActiveTab] = useState<DownloadTab>('cloud');
  const [cloudSubTab, setCloudSubTab] = useState<CloudSubTab>('torrents');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fileListDownload, setFileListDownload] = useState<CloudDownload | null>(null);

  const { settings, saveSettings, saving, saved, ready, error } = useSettings();
  const isDesktop = useMediaQuery('(min-width: 900px)', true);
  const isMobile = useMediaQuery('(max-width: 599px)', false);

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

  const handleTabChange = useCallback((tab: DownloadTab) => {
    setActiveTab(tab);
    setStatusFilter('all');
  }, []);

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
        startTransfer(download.id, download.type, download.name, download.sizeBytes);
        setActiveTab('local');
      }
    },
    [downloads, startTransfer]
  );

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
      if (statusFilter === 'active') {
        result = result.filter((d) => d.status === 'downloading');
      } else if (statusFilter === 'inactive') {
        result = result.filter((d) => d.status === 'queued' || d.status === 'cached');
      } else {
        result = result.filter((d) => d.status === 'error');
      }
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
  const visibleItems = activeTab === 'cloud' ? filteredDownloads : filteredTransfers;
  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== 'all';
  const isEmpty = !loading && (visibleItems?.length ?? 0) === 0;

  const activeError = activeTab === 'cloud' ? cloudError : localError;
  const errorKey = activeTab === 'cloud' ? 'cloud-error' : 'local-error';
  const showError = activeError !== null && !dismissedErrors.has(errorKey);

  const sideNavCloudCounts = useMemo(
    () => ({
      active: downloads.filter((d) => d.status === 'downloading').length,
      inactive: downloads.filter((d) => d.status === 'queued' || d.status === 'cached').length,
      error: cloudCounts.error,
      total: cloudCounts.total,
    }),
    [downloads, cloudCounts.error, cloudCounts.total]
  );

  const sideNavLocalCounts = useMemo(
    () => ({
      transferring: transfers.filter((t) => t.status === 'transferring').length,
      complete: transfers.filter((t) => t.status === 'complete').length,
      error: localCounts.error,
      total: localCounts.total,
    }),
    [transfers, localCounts.error, localCounts.total]
  );

  const aggregateSpeed = useMemo(() => {
    if (activeTab === 'cloud') {
      return (filteredDownloads ?? []).reduce((sum, d) => sum + (d.speedBytesPerSec ?? 0), 0);
    }
    return (filteredTransfers ?? []).reduce((sum, t) => sum + (t.speedBytesPerSec ?? 0), 0);
  }, [activeTab, filteredDownloads, filteredTransfers]);

  const statusCounts =
    activeTab === 'cloud'
      ? { total: cloudCounts.total, active: cloudCounts.active }
      : { total: localCounts.total, active: localCounts.active };

  const title = filterTitle(activeTab, statusFilter, cloudSubTab);

  return (
    <div className={classes.page}>
      <AppShell
        rail={
          !isMobile ? (
            <IconRail
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onAdd={() => setAddModalOpen(true)}
              onSettings={() => setSettingsOpen(true)}
            />
          ) : null
        }
        side={
          isDesktop ? (
            <SideNav
              activeTab={activeTab}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              cloudSubTab={cloudSubTab}
              onCloudSubTabChange={setCloudSubTab}
              torrentCount={cloudCounts.torrents}
              webCount={cloudCounts.web}
              cloudCounts={sideNavCloudCounts}
              localCounts={sideNavLocalCounts}
            />
          ) : null
        }
        header={
          <ContentHeader
            title={title}
            onRefresh={handleRefresh}
            onSettings={() => setSettingsOpen(true)}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            showMobileSettings={Boolean(isMobile)}
          />
        }
        filters={
          !isDesktop ? (
            <MobileFilters
              activeTab={activeTab}
              onTabChange={handleTabChange}
              cloudSubTab={cloudSubTab}
              onCloudSubTabChange={setCloudSubTab}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              cloudCount={cloudCounts.total}
              localCount={localCounts.total}
            />
          ) : null
        }
        badge={
          <SpeedBadge
            downloadBytesPerSec={aggregateSpeed}
            total={statusCounts.total}
            active={statusCounts.active}
          />
        }
      >
        {showError && (
          <ErrorBanner
            message={activeError!}
            onDismiss={() => setDismissedErrors((prev) => new Set(prev).add(errorKey))}
            onRetry={handleRefresh}
          />
        )}

        {isEmpty ? (
          <EmptyState
            variant={hasActiveFilters ? 'no-matches' : 'onboarding'}
            title={
              activeTab === 'cloud'
                ? settingsReady
                  ? 'No cloud downloads yet'
                  : 'API key required'
                : 'No local transfers yet'
            }
            description={
              activeTab === 'cloud'
                ? settingsReady
                  ? 'Add a magnet link or torrent file to start downloading on TorBox.'
                  : 'Set your TorBox API key in Settings to get started.'
                : 'Download cached files from TorBox to your device.'
            }
            actionLabel={activeTab === 'cloud' && !settingsReady ? 'Open Settings' : 'Add download'}
            onAction={
              activeTab === 'cloud' && !settingsReady
                ? () => setSettingsOpen(true)
                : () => setAddModalOpen(true)
            }
            onClearFilters={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          />
        ) : (
          <DownloadList
            downloads={filteredDownloads}
            transfers={filteredTransfers}
            loading={loading}
            onPause={pauseDownload}
            onResume={resumeDownload}
            onRemove={activeTab === 'cloud' ? removeDownload : removeTransfer}
            onRetry={activeTab === 'cloud' ? retryDownload : retryTransfer}
            onDownloadToDevice={activeTab === 'cloud' ? handleDownloadToDevice : undefined}
            onOpenFiles={(id) => {
              const download = downloads.find((d) => d.id === id);
              if (download && download.files.length > 0) {
                setFileListDownload(download);
              }
            }}
          />
        )}
      </AppShell>

      <div className={classes.mobileAddBar}>
        <Button
          className={classes.mobileAddButton}
          leftSection={<IconPlus size={16} stroke={2} />}
          onClick={() => setAddModalOpen(true)}
          variant="filled"
          size="compact-sm"
        >
          Add
        </Button>
      </div>

      <AddDownloadModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={async (name, type, url) => {
          if (!settings.api_key) {
            setAddModalOpen(false);
            setSettingsOpen(true);
            return;
          }
          await addDownload(name, type, url);
        }}
      />

      <FileListModal
        opened={fileListDownload !== null}
        onClose={() => setFileListDownload(null)}
        downloadName={fileListDownload?.name ?? ''}
        files={fileListDownload?.files ?? []}
        apiKey={settings.api_key}
        downloadType={fileListDownload?.type ?? 'torrent'}
        downloadId={fileListDownload ? parseNumericId(fileListDownload.id) : 0}
        onDownloadFile={(fileId, fileName, fileSize) => {
          if (fileListDownload) {
            startTransfer(fileListDownload.id, fileListDownload.type, fileName, fileSize, [fileId]);
            setActiveTab('local');
            setFileListDownload(null);
          }
        }}
      />

      <SettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        saving={saving}
        saved={saved}
        ready={ready}
        error={error}
        onSave={saveSettings}
      />
    </div>
  );
}

import type { CloudSubTab, DownloadTab } from '../../types/downloads';
import classes from './DownloadTabs.module.css';

export interface DownloadTabsProps {
  activeTab: DownloadTab;
  onTabChange: (tab: DownloadTab) => void;
  cloudSubTab?: CloudSubTab;
  onCloudSubTabChange?: (subTab: CloudSubTab) => void;
  cloudCount?: number;
  localCount?: number;
  torrentCount?: number;
  webCount?: number;
  /** Whether to show sub-tabs (only when cloud tab is active) */
  showSubTabs?: boolean;
}

export function DownloadTabs({
  activeTab,
  onTabChange,
  cloudSubTab = 'torrents',
  onCloudSubTabChange,
  cloudCount = 0,
  localCount = 0,
  torrentCount = 0,
  webCount = 0,
  showSubTabs = false,
}: DownloadTabsProps) {
  return (
    <div>
      {/* Main tabs: Cloud | Local */}
      <div className={classes.tabList} role="tablist" aria-label="Download categories">
        <button
          type="button"
          className={`${classes.tab} ${activeTab === 'cloud' ? classes.tabActive : ''}`}
          role="tab"
          aria-selected={activeTab === 'cloud'}
          onClick={() => onTabChange('cloud')}
        >
          Cloud
          <span className={classes.tabCount}>({cloudCount})</span>
        </button>
        <button
          type="button"
          className={`${classes.tab} ${activeTab === 'local' ? classes.tabActive : ''}`}
          role="tab"
          aria-selected={activeTab === 'local'}
          onClick={() => onTabChange('local')}
        >
          Local
          <span className={classes.tabCount}>({localCount})</span>
        </button>
      </div>

      {/* Cloud sub-tabs */}
      {showSubTabs && onCloudSubTabChange && (
        <div className={classes.subTabList} role="tablist" aria-label="Cloud download types">
          <button
            type="button"
            className={`${classes.tab} ${classes.subTab} ${cloudSubTab === 'torrents' ? classes.tabActive : ''}`}
            role="tab"
            aria-selected={cloudSubTab === 'torrents'}
            onClick={() => onCloudSubTabChange('torrents')}
          >
            Torrents
            <span className={classes.tabCount}>({torrentCount})</span>
          </button>
          <button
            type="button"
            className={`${classes.tab} ${classes.subTab} ${cloudSubTab === 'web' ? classes.tabActive : ''}`}
            role="tab"
            aria-selected={cloudSubTab === 'web'}
            onClick={() => onCloudSubTabChange('web')}
          >
            Web DLs
            <span className={classes.tabCount}>({webCount})</span>
          </button>
        </div>
      )}
    </div>
  );
}

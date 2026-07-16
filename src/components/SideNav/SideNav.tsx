import {
  IconAlertTriangle,
  IconPlayerPause,
  IconPlayerPlay,
  IconStack2,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { CloudSubTab, DownloadTab } from '../../types/downloads';
import classes from './SideNav.module.css';

export type CloudFilterStatus = 'all' | 'active' | 'inactive' | 'error';
export type LocalFilterStatus = 'all' | 'transferring' | 'complete' | 'error';
export type StatusFilter = CloudFilterStatus | LocalFilterStatus;

export interface SideNavProps {
  activeTab: DownloadTab;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  cloudSubTab: CloudSubTab;
  onCloudSubTabChange: (subTab: CloudSubTab) => void;
  torrentCount: number;
  webCount: number;
  cloudCounts: { active: number; inactive: number; error: number; total: number };
  localCounts: { transferring: number; complete: number; error: number; total: number };
}

interface NavItem {
  value: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

export function SideNav({
  activeTab,
  statusFilter,
  onStatusFilterChange,
  cloudSubTab,
  onCloudSubTabChange,
  torrentCount,
  webCount,
  cloudCounts,
  localCounts,
}: SideNavProps) {
  const statusItems: NavItem[] =
    activeTab === 'cloud'
      ? [
          {
            value: 'active',
            label: 'Active',
            icon: <IconPlayerPlay size={16} stroke={2} />,
            count: cloudCounts.active,
          },
          {
            value: 'inactive',
            label: 'Inactive',
            icon: <IconPlayerPause size={16} stroke={2} />,
            count: cloudCounts.inactive,
          },
          {
            value: 'error',
            label: 'Error',
            icon: <IconAlertTriangle size={16} stroke={2} />,
            count: cloudCounts.error,
          },
          {
            value: 'all',
            label: 'All',
            icon: <IconStack2 size={16} stroke={2} />,
            count: cloudCounts.total,
          },
        ]
      : [
          {
            value: 'transferring',
            label: 'Transferring',
            icon: <IconPlayerPlay size={16} stroke={2} />,
            count: localCounts.transferring,
          },
          {
            value: 'complete',
            label: 'Complete',
            icon: <IconStack2 size={16} stroke={2} />,
            count: localCounts.complete,
          },
          {
            value: 'error',
            label: 'Error',
            icon: <IconAlertTriangle size={16} stroke={2} />,
            count: localCounts.error,
          },
          {
            value: 'all',
            label: 'All',
            icon: <IconStack2 size={16} stroke={2} />,
            count: localCounts.total,
          },
        ];

  return (
    <aside className={classes.side}>
      <div className={classes.section}>
        <div className={classes.sectionLabel}>Status</div>
        <div className={classes.list} role="listbox" aria-label="Filter by status">
          {statusItems.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={statusFilter === item.value}
              className={`${classes.item} ${statusFilter === item.value ? classes.itemActive : ''}`}
              onClick={() => onStatusFilterChange(item.value as StatusFilter)}
            >
              <span className={classes.itemIcon}>{item.icon}</span>
              <span className={classes.itemLabel}>{item.label}</span>
              {item.count !== undefined && <span className={classes.itemCount}>{item.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'cloud' && (
        <div className={classes.section}>
          <div className={classes.sectionLabel}>Type</div>
          <div className={classes.list} role="listbox" aria-label="Cloud download type">
            <button
              type="button"
              role="option"
              aria-selected={cloudSubTab === 'torrents'}
              className={`${classes.item} ${cloudSubTab === 'torrents' ? classes.itemActive : ''}`}
              onClick={() => onCloudSubTabChange('torrents')}
            >
              <span className={classes.itemLabel}>Torrents</span>
              <span className={classes.itemCount}>{torrentCount}</span>
            </button>
            <button
              type="button"
              role="option"
              aria-selected={cloudSubTab === 'web'}
              className={`${classes.item} ${cloudSubTab === 'web' ? classes.itemActive : ''}`}
              onClick={() => onCloudSubTabChange('web')}
            >
              <span className={classes.itemLabel}>Web DLs</span>
              <span className={classes.itemCount}>{webCount}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

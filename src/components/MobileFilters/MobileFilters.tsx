import type { CloudSubTab, DownloadTab } from '../../types/downloads';
import type { StatusFilter } from '../SideNav/SideNav';
import classes from './MobileFilters.module.css';

export interface MobileFiltersProps {
  activeTab: DownloadTab;
  onTabChange: (tab: DownloadTab) => void;
  cloudSubTab: CloudSubTab;
  onCloudSubTabChange: (subTab: CloudSubTab) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  cloudCount: number;
  localCount: number;
}

export function MobileFilters({
  activeTab,
  onTabChange,
  cloudSubTab,
  onCloudSubTabChange,
  statusFilter,
  onStatusFilterChange,
  cloudCount,
  localCount,
}: MobileFiltersProps) {
  const statusOptions =
    activeTab === 'cloud'
      ? [
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'error', label: 'Error' },
        ]
      : [
          { value: 'all', label: 'All' },
          { value: 'transferring', label: 'Transferring' },
          { value: 'complete', label: 'Complete' },
          { value: 'error', label: 'Error' },
        ];

  return (
    <div className={classes.wrap}>
      <div className={classes.row} role="tablist" aria-label="Download mode">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cloud'}
          className={`${classes.chip} ${activeTab === 'cloud' ? classes.chipActive : ''}`}
          onClick={() => onTabChange('cloud')}
        >
          Cloud ({cloudCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'local'}
          className={`${classes.chip} ${activeTab === 'local' ? classes.chipActive : ''}`}
          onClick={() => onTabChange('local')}
        >
          Local ({localCount})
        </button>
      </div>

      {activeTab === 'cloud' && (
        <div className={classes.row} role="tablist" aria-label="Cloud download type">
          <button
            type="button"
            role="tab"
            aria-selected={cloudSubTab === 'torrents'}
            className={`${classes.chip} ${cloudSubTab === 'torrents' ? classes.chipActive : ''}`}
            onClick={() => onCloudSubTabChange('torrents')}
          >
            Torrents
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cloudSubTab === 'web'}
            className={`${classes.chip} ${cloudSubTab === 'web' ? classes.chipActive : ''}`}
            onClick={() => onCloudSubTabChange('web')}
          >
            Web DLs
          </button>
        </div>
      )}

      <div className={classes.row} role="listbox" aria-label="Filter by status">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={statusFilter === option.value}
            className={`${classes.chip} ${statusFilter === option.value ? classes.chipActive : ''}`}
            onClick={() => onStatusFilterChange(option.value as StatusFilter)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

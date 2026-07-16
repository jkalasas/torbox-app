import { IconCloud, IconDeviceDesktopDown, IconPlus, IconSettings } from '@tabler/icons-react';
import type { DownloadTab } from '../../types/downloads';
import classes from './IconRail.module.css';

export interface IconRailProps {
  activeTab: DownloadTab;
  onTabChange: (tab: DownloadTab) => void;
  onAdd: () => void;
  onSettings: () => void;
}

export function IconRail({ activeTab, onTabChange, onAdd, onSettings }: IconRailProps) {
  return (
    <nav className={classes.rail} aria-label="Primary navigation">
      <div className={classes.dragRegion} data-tauri-drag-region />
      <div className={classes.top}>
        <div className={classes.logo} aria-hidden="true" data-tauri-drag-region>
          TB
        </div>

        <div className={classes.group} role="tablist" aria-label="Download mode">
          <button
            type="button"
            className={`${classes.item} ${activeTab === 'cloud' ? classes.itemActive : ''}`}
            role="tab"
            aria-selected={activeTab === 'cloud'}
            aria-label="Cloud downloads"
            onClick={() => onTabChange('cloud')}
          >
            <IconCloud size={20} stroke={1.75} />
          </button>
          <button
            type="button"
            className={`${classes.item} ${activeTab === 'local' ? classes.itemActive : ''}`}
            role="tab"
            aria-selected={activeTab === 'local'}
            aria-label="Local transfers"
            onClick={() => onTabChange('local')}
          >
            <IconDeviceDesktopDown size={20} stroke={1.75} />
          </button>
        </div>

        <button type="button" className={classes.item} aria-label="Add download" onClick={onAdd}>
          <IconPlus size={20} stroke={1.75} />
        </button>
      </div>

      <div className={classes.bottom}>
        <button type="button" className={classes.item} aria-label="Settings" onClick={onSettings}>
          <IconSettings size={20} stroke={1.75} />
        </button>
      </div>
    </nav>
  );
}

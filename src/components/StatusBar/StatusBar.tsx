import type { DownloadTab } from '../../types/downloads';
import classes from './StatusBar.module.css';

export interface StatusBarProps {
  activeTab: DownloadTab;
  total: number;
  active: number;
  error: number;
}

export function StatusBar({
  activeTab,
  total,
  active,
  error,
}: StatusBarProps) {
  const context = activeTab === 'cloud' ? 'cloud download' : 'local transfer';

  return (
    <output
      className={classes.bar}
      aria-live="polite"
      aria-label={`Status: ${total} ${context}${total !== 1 ? 's' : ''}, ${active} active, ${error} errors`}
    >
      <div className={classes.stats}>
        <span className={classes.stat}>
          {total} {context}{total !== 1 ? 's' : ''}
        </span>
        {active > 0 && (
          <>
            <span className={classes.statSeparator} aria-hidden="true">
              ·
            </span>
            <span className={classes.stat}>{active} active</span>
          </>
        )}
        {error > 0 && (
          <>
            <span className={classes.statSeparator} aria-hidden="true">
              ·
            </span>
            <span className={`${classes.stat} ${classes.statError}`}>
              {error} error{error !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </output>
  );
}

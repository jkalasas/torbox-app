import type { ReactNode } from 'react';
import { isDesktopShell, isMacOS, showCustomWindowControls } from '../../utils/platform';
import { WindowControls } from '../WindowControls/WindowControls';
import classes from './AppShell.module.css';

export interface AppShellProps {
  rail: ReactNode;
  side?: ReactNode;
  header: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
}

export function AppShell({ rail, side, header, filters, children, badge }: AppShellProps) {
  const desktop = isDesktopShell();
  const mac = isMacOS();
  const customControls = showCustomWindowControls();

  return (
    <div
      className={[
        classes.shell,
        desktop ? classes.desktop : '',
        mac ? classes.mac : '',
        customControls ? classes.customControls : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {customControls && (
        <div className={classes.titleBar} data-tauri-drag-region>
          <div className={classes.titleBarSpacer} data-tauri-drag-region />
          <WindowControls />
        </div>
      )}

      <div className={classes.body}>
        {rail}
        {side}
        <main className={classes.main}>
          {header}
          {filters}
          <div className={classes.content}>{children}</div>
          {badge}
        </main>
      </div>
    </div>
  );
}

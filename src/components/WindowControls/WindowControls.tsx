import { IconMinus, IconSquare, IconX } from '@tabler/icons-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useState } from 'react';
import { showCustomWindowControls } from '../../utils/platform';
import classes from './WindowControls.module.css';

export function WindowControls() {
  const [visible, setVisible] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setVisible(showCustomWindowControls());
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let unlisten: (() => void) | undefined;

    const sync = async () => {
      try {
        const win = getCurrentWindow();
        setMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setMaximized(await win.isMaximized());
        });
      } catch {
        // Not running inside Tauri
      }
    };

    void sync();
    return () => unlisten?.();
  }, [visible]);

  const minimize = useCallback(async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {
      // ignore
    }
  }, []);

  const toggleMaximize = useCallback(async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {
      // ignore
    }
  }, []);

  const close = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      // ignore
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className={classes.controls} role="group" aria-label="Window controls">
      <button type="button" className={classes.button} onClick={minimize} aria-label="Minimize">
        <IconMinus size={14} stroke={2} />
      </button>
      <button
        type="button"
        className={classes.button}
        onClick={toggleMaximize}
        aria-label={maximized ? 'Restore' : 'Maximize'}
      >
        <IconSquare size={12} stroke={2} />
      </button>
      <button
        type="button"
        className={`${classes.button} ${classes.close}`}
        onClick={close}
        aria-label="Close"
      >
        <IconX size={14} stroke={2} />
      </button>
    </div>
  );
}

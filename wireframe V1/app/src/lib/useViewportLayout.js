import { useEffect, useState } from 'react';
import {
  HANDHELD_MAX_WIDTH,
  TABLET_MAX_WIDTH,
  readViewportLayout,
} from './viewportLayout.js';

/**
 * Tracks desktop / tablet / handheld layout from viewport width.
 */
export function useViewportLayout() {
  const [layout, setLayout] = useState(readViewportLayout);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const tabletMq = window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`);
    const handheldMq = window.matchMedia(`(max-width: ${HANDHELD_MAX_WIDTH}px)`);

    const sync = () => {
      setLayout(readViewportLayout());
    };

    sync();
    tabletMq.addEventListener('change', sync);
    handheldMq.addEventListener('change', sync);
    window.addEventListener('resize', sync);

    return () => {
      tabletMq.removeEventListener('change', sync);
      handheldMq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return layout;
}

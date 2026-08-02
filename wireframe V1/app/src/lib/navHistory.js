import { createContext, useContext } from 'react';

/**
 * App-level navigation history for Back-stack traversal.
 * Snapshot shape is owned by App; consumers call navigate / goBack.
 */
export const NavHistoryContext = createContext(null);

export function useNavHistory() {
  const ctx = useContext(NavHistoryContext);
  if (!ctx) {
    return {
      canGoBack: false,
      goBack: () => {},
      revealsNav: false,
      navigate: (patch) => {
        if (typeof patch === 'function') patch();
      },
    };
  }
  return ctx;
}

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const GlossaryContext = createContext(null);

export function GlossaryProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [termId, setTermId] = useState(null);

  const openGlossary = useCallback((nextTermId = null) => {
    setTermId(nextTermId || null);
    setOpen(true);
  }, []);

  const closeGlossary = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ open, termId, openGlossary, closeGlossary, setTermId }),
    [open, termId, openGlossary, closeGlossary],
  );

  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

export function useGlossary() {
  const ctx = useContext(GlossaryContext);
  if (!ctx) {
    throw new Error('useGlossary requires GlossaryProvider');
  }
  return ctx;
}

export function useOptionalGlossary() {
  return useContext(GlossaryContext);
}

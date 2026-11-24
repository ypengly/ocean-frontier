import { useEffect, useState } from 'react';

/** Re-renders the component every `ms` milliseconds so it can read mutable runtime state. */
export function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
}

import { useEffect } from 'react';
import { targets, type Target } from '../world.ts';

/** Registers a scannable target with the scan/sonar systems for the lifetime of the component. */
export function useTarget(t: Target | null) {
  useEffect(() => {
    if (!t) return;
    targets.set(t.id, t);
    return () => { targets.delete(t.id); };
  }, [t]);
}

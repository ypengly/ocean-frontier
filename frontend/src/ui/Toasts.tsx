import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore.ts';

const TONE = { info: 'border-tide-500/50', good: 'border-lagoon-400/70', warn: 'border-warn-400/70', bad: 'border-danger-500/70' } as const;

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute bottom-20 right-4 flex w-80 flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className={`glass rounded-lg border-l-4 px-4 py-2.5 text-sm text-white ${TONE[t.tone]}`}>{t.text}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

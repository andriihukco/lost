'use client';

import { type ReactNode, useEffect } from 'react';
import { motion, type PanInfo, useDragControls } from 'motion/react';
import Icon from '@/components/Icon';

const CLOSE_DISTANCE_PX = 120; // a drag of this length, or a fast flick down, closes the screen
const CLOSE_VELOCITY = 600; // px/s

type Props = { title: string; onClose: () => void; children: ReactNode };

// A full-screen treasure view. It slides up over the map and the tab bar. The header closes it: tap ×,
// drag the header down, or press Escape.
export default function TreasureModal({ title, onClose, children }: Props) {
  const controls = useDragControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > CLOSE_DISTANCE_PX || info.velocity.y > CLOSE_VELOCITY) onClose();
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--page)]"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', visualDuration: 0.4, bounce: 0 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.35 }}
      dragMomentum={false}
      onDragEnd={onDragEnd}
    >
      <header
        onPointerDown={(e) => controls.start(e)}
        className="shrink-0 cursor-grab touch-none select-none border-b border-[var(--line)] bg-[var(--paper)] px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      >
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--line)]" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="dl-title min-w-0 truncate text-[22px]">{title}</h2>
          <button
            type="button"
            aria-label="Закрити"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-[var(--muted)]"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>
        {children}
      </div>
    </motion.div>
  );
}

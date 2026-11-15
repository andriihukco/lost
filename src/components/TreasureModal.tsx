'use client';

import { type ReactNode, useEffect } from 'react';
import { motion, type PanInfo, useDragControls } from 'motion/react';
import Icon from '@/components/Icon';

const CLOSE_DISTANCE_PX = 120; // a drag of this length, or a fast flick down, closes the sheet
const CLOSE_VELOCITY = 600; // px/s

type Props = { title: string; onClose: () => void; children: ReactNode };

// A treasure sheet, as on iOS: it rises over a dimmed map and covers most of the screen, but not all of it, so the
// map stays in view. Close it with ×, a tap on the dimmed map, a drag down from the header, or Escape.
// On a wide screen it is a centred panel.
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
    <>
      {/* The scrim: the map stays visible and dimmed behind the sheet; a tap on it closes the sheet. */}
      <motion.div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[var(--ink)]/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[min(84dvh,calc(100dvh-56px))] flex-col rounded-t-[28px] bg-[var(--page)] elev-sheet md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:h-[min(760px,calc(100dvh-48px))] md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]"
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
          className="relative shrink-0 cursor-grab touch-none select-none px-5 pb-3 pt-2"
        >
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />
          <div className="flex items-center justify-center">
            <h2 className="min-w-0 truncate px-12 text-center text-[18px] font-bold">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Закрити"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="absolute right-4 top-2 grid h-9 w-9 place-items-center rounded-full bg-[var(--line)]/70 text-[var(--muted)]"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-[28px]" style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}

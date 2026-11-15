'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { motion, type PanInfo, useDragControls } from 'motion/react';
import Icon from '@/components/Icon';

const CLOSE_DISTANCE_PX = 120; // a drag of this length, or a fast flick down, closes the sheet
const CLOSE_VELOCITY = 600; // px/s

type Props = { title: string; onClose: () => void; children: ReactNode };

// A treasure view. On a phone it rises as a sheet over a dimmed map (about 84% of the height): close it with ×,
// a tap on the dimmed map, a drag down from the header, or Escape. On a wide screen it is a sidebar on the right,
// and the map stays in full view and in focus beside it.
export default function TreasureModal({ title, onClose, children }: Props) {
  const controls = useDragControls();
  // Decided once, when the view opens: the sheet and the sidebar animate differently.
  const [wide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

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
      {/* The dimmed map behind a phone sheet; a tap on it closes the sheet. A sidebar has none: the map stays in focus. */}
      {!wide && (
        <motion.div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[var(--ink)]/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
      <motion.div
        role="dialog"
        aria-modal={wide ? undefined : true}
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[min(84dvh,calc(100dvh-56px))] flex-col rounded-t-[28px] bg-[var(--page)] elev-sheet md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:w-[440px] md:rounded-none md:border-l md:border-[var(--line)] md:elev-lg"
        initial={wide ? { x: '100%' } : { y: '100%' }}
        animate={wide ? { x: 0 } : { y: 0 }}
        exit={wide ? { x: '100%' } : { y: '100%' }}
        transition={{ type: 'spring', visualDuration: 0.4, bounce: 0 }}
        drag={wide ? false : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.35 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        <header
          onPointerDown={(e) => { if (!wide) controls.start(e); }}
          className={`relative shrink-0 select-none px-5 pb-3 pt-2 ${wide ? '' : 'cursor-grab touch-none'}`}
        >
          {!wide && <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--line)]" />}
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-[28px] md:rounded-none" style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}

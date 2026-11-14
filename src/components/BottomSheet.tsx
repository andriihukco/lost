'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { animate, motion, type AnimationPlaybackControls, type PanInfo, useDragControls, useMotionValue } from 'motion/react';
import { nearestSnap, SNAPS, type SnapName } from '@/lib/sheetSnap';

const FLICK_PX_PER_S = 800; // faster than this may overshoot slightly (damping 0.82)
const RUBBER_BAND = 0.25; // resistance above the full snap

type Props = {
  children: ReactNode; // scrolls on its own
  header?: ReactNode; // title and close button; the header and the grabber are the only drag handle
  initial?: SnapName;
  bottomOffset?: number; // the tab bar height: the sheet stops above it
};

// Three-snap sheet (peek 18%, half 50%, full 92%). Only the grabber and header drag it, so the body scrolls
// natively and never fights the sheet. The release point is projected from velocity and the sheet springs
// to the nearest snap. It is positioned by transform only, so a drag does not relayout the page.
export default function BottomSheet({ children, header, initial = 'peek', bottomOffset = 0 }: Props) {
  const [vh, setVh] = useState(0);
  const y = useMotionValue(0); // 0 = full snap; grows downward
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const controls = useDragControls();

  useEffect(() => {
    // The sheet fills the screen above the tab bar.
    const update = () => setVh(window.innerHeight - bottomOffset);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [bottomOffset]);

  const offsetFor = (snap: SnapName) => vh * (SNAPS.full - SNAPS[snap]);
  const maxOffset = vh * (SNAPS.full - SNAPS.peek);

  // Start at the initial snap once the viewport is measured.
  useEffect(() => {
    if (vh > 0) y.set(offsetFor(initial));
  }, [vh]);

  const settle = (snap: SnapName, flick: boolean) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    anim.current = animate(
      y,
      offsetFor(snap),
      reduce
        ? { duration: 0.15, ease: 'easeOut' }
        : { type: 'spring', visualDuration: 0.35, bounce: flick ? 0.18 : 0 },
    );
  };

  const onDragStart = () => {
    anim.current?.stop(); // interruptible: a new grab takes over an in-flight snap
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (vh === 0) return;
    const current = (vh * SNAPS.full - y.get()) / vh; // visible fraction
    const flick = Math.abs(info.velocity.y) > FLICK_PX_PER_S;
    settle(nearestSnap(current, info.velocity.y, vh), flick);
  };

  if (vh === 0) return null;

  // The clip box ends where the tab bar begins, so nothing of the sheet slides under the bar. Taps above the
  // sheet pass through to the map.
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 overflow-hidden" style={{ bottom: bottomOffset }}>
      <motion.div
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] bg-[var(--paper)] elev-sheet"
        style={{ height: vh * SNAPS.full, y, willChange: 'transform' }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: maxOffset }}
        dragElastic={{ top: RUBBER_BAND, bottom: 0.05 }} // resistance above full, almost none below peek
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          onPointerDown={(e) => controls.start(e)}
          className="shrink-0 cursor-grab select-none px-5 pb-3 pt-2.5"
          style={{ touchAction: 'none' }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--line)]" aria-hidden />
          {header && <div className="mt-3">{header}</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]" style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

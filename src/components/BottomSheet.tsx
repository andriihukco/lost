'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { animate, motion, type AnimationPlaybackControls, type PanInfo, useMotionValue } from 'motion/react';
import { nearestSnap, SNAPS, type SnapName } from '@/lib/sheetSnap';

const FLICK_PX_PER_S = 800; // faster than this may overshoot slightly (damping 0.82)
const RUBBER_BAND = 0.25; // resistance above the full snap

type Props = { children: ReactNode; initial?: SnapName };

// Three-snap sheet (peek 18%, half 50%, full 92%). Follows the finger through Motion's drag,
// projects the release point from velocity, and springs to the nearest snap (spec §5.3).
export default function BottomSheet({ children, initial = 'peek' }: Props) {
  const [vh, setVh] = useState(0);
  const y = useMotionValue(0); // 0 = full snap; grows downward
  const anim = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 touch-none rounded-t-3xl bg-white/90 shadow-2xl backdrop-blur"
      style={{ height: vh * SNAPS.full, y }}
      drag="y"
      dragConstraints={{ top: 0, bottom: maxOffset }}
      dragElastic={{ top: RUBBER_BAND, bottom: 0.05 }} // resistance above full, almost none below peek
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="mx-auto mt-2 h-1.5 w-10 cursor-grab rounded-full bg-neutral-400" aria-hidden />
      <div className="h-[calc(100%-1.5rem)] overflow-y-auto overscroll-contain">{children}</div>
    </motion.div>
  );
}

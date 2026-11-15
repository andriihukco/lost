'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

// Every animation in the app follows the system "reduce motion" setting: slides and sheets then appear
// without moving.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

'use client';

import PillTabBar from '@/components/PillTabBar';
import type { PillItem } from '@/components/PillTabBar';

export type Tab = 'map' | 'finds' | 'rating' | 'profile';

const ITEMS: PillItem<Tab>[] = [
  { id: 'map', label: 'Карта', icon: 'map' },
  { id: 'finds', label: 'Знахідки', icon: 'diamond_shine' },
  { id: 'rating', label: 'Рейтинг', icon: 'trophy' },
  { id: 'profile', label: 'Профіль', icon: 'person' },
];

// The player's navigation: the shared pill, with the four player screens.
export default function TabBar({ tab, onChange, onHeight }: { tab: Tab; onChange: (t: Tab) => void; onHeight: (h: number) => void }) {
  return <PillTabBar items={ITEMS} value={tab} onChange={onChange} onHeight={onHeight} navLabel="Головна навігація" />;
}

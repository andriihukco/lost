'use client';

import Link from 'next/link';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminObjectList, { type ListFilter, type ListSelection } from '@/components/AdminObjectList';
import Icon from '@/components/Icon';
import MapView, { type OtherPlayer } from '@/components/MapView';
import MarkForm from '@/components/MarkForm';
import PillTabBar from '@/components/PillTabBar';
import TreasureEditor from '@/components/TreasureEditor';
import TreasureForm from '@/components/TreasureForm';
import TreasureModal from '@/components/TreasureModal';
import { listPlayers, type AdminPlayer } from '@/lib/adminPlayers';
import { listTreasures, type AdminTreasure } from '@/lib/adminTreasures';
import type { LatLng } from '@/lib/geo';
import { deleteMapMark, listMapMarks, type MapMark } from '@/lib/mapMarks';

const REFRESH_MS = 15000;

// What the sheet is showing: an existing object to edit, or a new one at a point the admin picked on the map.
type Editor =
  | { type: 'treasure'; id: string }
  | { type: 'mark'; id: string }
  | { type: 'new-treasure'; point: LatLng }
  | { type: 'new-mark'; point: LatLng };

// The admin's one page: the map is the page. Everything on it (treasures, marks, players) is shown on the map and
// listed beside it. Tap a pin or a row to edit it; "+" chooses what to add, then a tap on the map says where.
export default function AdminMapPage({ onSignOut, onSection }: { onSignOut: () => void; onSection: (s: 'players') => void }) {
  const [treasures, setTreasures] = useState<AdminTreasure[]>([]);
  const [marks, setMarks] = useState<MapMark[]>([]);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [placing, setPlacing] = useState<'treasure' | 'mark' | null>(null); // the next tap on the map places this
  const [addOpen, setAddOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false); // phones: the list is a panel that opens on demand
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [fitTo, setFitTo] = useState<LatLng[] | undefined>(undefined);

  const reload = useCallback(async () => {
    try {
      const [t, m, p] = await Promise.all([listTreasures(), listMapMarks(), listPlayers()]);
      setTreasures(t);
      setMarks(m);
      setPlayers(p);
      setLoadError(null);
      // The camera fits everything once, the first time there is something to fit.
      const points: LatLng[] = [
        ...p.filter((x) => x.lat !== null && x.lng !== null).map((x) => ({ lat: x.lat as number, lng: x.lng as number })),
        ...t.map((x) => ({ lat: x.lat, lng: x.lng })),
        ...m.map((x) => ({ lat: x.lat, lng: x.lng })),
      ];
      setFitTo((prev) => (prev !== undefined || points.length === 0 ? prev : points));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, [reload]);

  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.user_id, p.nickname])), [players]);
  const others: OtherPlayer[] = useMemo(
    () =>
      players
        .filter((p) => p.lat !== null && p.lng !== null)
        .map((p) => ({
          id: p.user_id,
          nickname: p.nickname,
          avatar: p.avatar,
          lat: p.lat as number,
          lng: p.lng as number,
          heading: null,
          seenAt: p.seen_at ? Date.parse(p.seen_at) : 0,
        })),
    [players],
  );

  // A tap on the map while placing: the sheet opens a new form at that point.
  const onMapClick = useCallback(
    (p: LatLng) => {
      if (!placing) return;
      setEditor({ type: placing === 'treasure' ? 'new-treasure' : 'new-mark', point: p });
      setPlacing(null);
    },
    [placing],
  );

  // A pin on the map and a row in the list both pass an object with its id and position.
  function openTreasure(t: { id: string; lat: number; lng: number }) {
    setEditor({ type: 'treasure', id: t.id });
    setFocus({ lat: t.lat, lng: t.lng, nonce: Date.now() });
    setListOpen(false);
  }
  function openMark(m: MapMark) {
    setEditor({ type: 'mark', id: m.id });
    setFocus({ lat: m.lat, lng: m.lng, nonce: Date.now() });
    setListOpen(false);
  }
  function closeEditor() {
    setEditor(null);
  }
  // Saved, deleted or created: the sheet closes and the map and list show the new state.
  function finished() {
    setEditor(null);
    void reload();
  }
  function startAdding(kind: 'treasure' | 'mark') {
    setAddOpen(false);
    setListOpen(false);
    setPlacing(kind);
  }

  const selectedInList: ListSelection =
    editor?.type === 'treasure' || editor?.type === 'mark' ? { kind: editor.type, id: editor.id } : null;

  // The sheet's content, from the editor state. A treasure or mark that is gone (removed elsewhere) closes the sheet.
  const sheet = useMemo(() => {
    if (!editor) return null;
    if (editor.type === 'treasure') {
      const t = treasures.find((x) => x.id === editor.id);
      if (!t) return null;
      return {
        key: `t-${t.id}`,
        title: t.title,
        body: <TreasureEditor treasure={t} names={names} onChanged={() => void reload()} onDeleted={finished} />,
      };
    }
    if (editor.type === 'mark') {
      const m = marks.find((x) => x.id === editor.id);
      if (!m) return null;
      return { key: `m-${m.id}`, title: m.title, body: <MarkEditor mark={m} onDone={finished} /> };
    }
    if (editor.type === 'new-treasure') {
      return {
        key: `new-t-${editor.point.lat}-${editor.point.lng}`,
        title: 'Новий скарб',
        body: <TreasureForm initialPoint={editor.point} onCreated={finished} />,
      };
    }
    return {
      key: `new-m-${editor.point.lat}-${editor.point.lng}`,
      title: 'Нова мітка',
      body: <MarkForm initialPoint={editor.point} onSaved={finished} />,
    };
    // finished and reload are stable enough: they only read state that is current on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, treasures, marks, names]);

  const addButton = (
    <button
      type="button"
      aria-label={addOpen ? 'Закрити меню' : 'Додати на карту'}
      aria-expanded={addOpen}
      onClick={() => setAddOpen((v) => !v)}
      className="grid h-11 w-11 place-items-center rounded-full bg-[var(--green)] text-white elev-green transition-transform active:scale-95"
    >
      <Icon name={addOpen ? 'close' : 'add'} size={24} />
    </button>
  );

  const list = (
    <AdminObjectList
      treasures={treasures}
      marks={marks}
      names={names}
      filter={filter}
      onFilter={setFilter}
      selected={selectedInList}
      onOpenTreasure={openTreasure}
      onOpenMark={openMark}
    />
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[var(--page)]">
      {/* The map fills the page. On a wide screen the list is a sidebar on the left, so the map starts after it. */}
      <div className="absolute inset-0 md:left-[380px]">
        <MapView
          treasures={treasures}
          distances={{}}
          me={null}
          meAvatar={null}
          meName={null}
          meHeading={null}
          others={others}
          bottomInset={listOpen ? 56 : 96}
          marks={marks}
          unlimited
          fitTo={fitTo}
          focusPoint={focus}
          onSelectTreasure={openTreasure}
          onSelectMark={openMark}
          onMapClick={onMapClick}
        />
      </div>

      {/* Wide screens: the sidebar with the list. */}
      <aside className="absolute inset-y-0 left-0 hidden w-[380px] flex-col border-r border-[var(--line)] bg-[var(--paper)] md:flex">
        <header className="flex items-center gap-3 px-5 pb-3 pt-5">
          <Link href="/" aria-label="На карту" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--page)] text-[var(--ink)]">
            <Icon name="arrow_back" size={20} />
          </Link>
          <h1 className="dl-title min-w-0 flex-1 text-[22px]">Карта</h1>
          {addButton}
          <button type="button" onClick={onSignOut} aria-label="Вийти" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--page)] text-[var(--muted)]">
            <Icon name="logout" size={20} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-24">{list}</div>
      </aside>

      {/* Phones: a floating header; the list is a panel at the bottom that opens on demand. */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:hidden">
        <Link href="/" aria-label="На карту" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm">
          <Icon name="arrow_back" size={22} />
        </Link>
        <p className="rounded-full bg-[var(--paper)]/95 px-4 py-2 text-[15px] font-bold elev-sm">Адмін · Карта</p>
        <div className="flex items-center gap-2">
          {addButton}
          <button type="button" onClick={onSignOut} aria-label="Вийти" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] elev-sm">
            <Icon name="logout" size={22} />
          </button>
        </div>
      </header>

      {/* What "+" can add. It sits under the header, opened from it. */}
      {addOpen && (
        <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 flex flex-col gap-2 rounded-2xl bg-[var(--paper)] p-2 elev-md md:top-5 md:right-auto md:left-[392px]">
          <button type="button" onClick={() => startAdding('treasure')} className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 font-bold hover:bg-[var(--page)]">
            <Icon name="travel_explore" size={20} className="text-[var(--green-deep)]" />
            Скарб
          </button>
          <button type="button" onClick={() => startAdding('mark')} className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 font-bold hover:bg-[var(--page)]">
            <Icon name="warning" size={20} className="text-[var(--green-deep)]" />
            Мітка
          </button>
        </div>
      )}

      {/* While placing: say what the next tap on the map does, and how to stop. */}
      {placing && (
        <div role="status" className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 flex items-center gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-white elev-md md:left-[404px] md:right-6 md:top-5">
          <p className="min-w-0 flex-1 text-[15px] font-semibold">
            Торкніться карти, щоб поставити {placing === 'treasure' ? 'скарб' : 'мітку'}
          </p>
          <button type="button" onClick={() => setPlacing(null)} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[14px] font-bold">
            Скасувати
          </button>
        </div>
      )}

      {loadError && (
        <p role="alert" className="absolute inset-x-4 bottom-28 z-20 rounded-2xl bg-[var(--paper)] p-3 text-center text-[14px] font-semibold text-[var(--danger)] elev-sm md:left-[404px]">
          {loadError}
        </p>
      )}

      {/* Phones: the list panel. Closed, it is a handle with the counts; open, it shows the list. */}
      <section
        className="absolute inset-x-0 z-20 flex flex-col rounded-t-[24px] border-t border-[var(--line)] bg-[var(--paper)] px-4 pt-2 elev-sheet md:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)', maxHeight: listOpen ? '55dvh' : undefined }}
      >
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          aria-expanded={listOpen}
          className="flex min-h-[44px] w-full flex-col items-center gap-1 pb-2"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-[var(--line)]" />
          <span className="text-[14px] font-bold text-[var(--muted)]">
            Скарби {treasures.length} · Мітки {marks.length} · {listOpen ? 'сховати' : 'показати список'}
          </span>
        </button>
        {listOpen && <div className="flex min-h-0 flex-1 flex-col pb-4">{list}</div>}
      </section>

      <PillTabBar
        navLabel="Розділи адмінки"
        position="fixed"
        items={[
          { id: 'map', label: 'Карта', icon: 'map' },
          { id: 'players', label: 'Гравці', icon: 'group' },
        ]}
        value="map"
        onChange={(id) => {
          if (id === 'players') onSection('players');
        }}
      />

      {/* The editor: an existing object, or the form for a new one at the point picked on the map. */}
      <AnimatePresence>
        {sheet && (
          <TreasureModal key={sheet.key} title={sheet.title} onClose={closeEditor}>
            {sheet.body}
          </TreasureModal>
        )}
      </AnimatePresence>
    </main>
  );
}

// A map mark's editor: the mark form, and deleting the mark (with a confirmation).
function MarkEditor({ mark, onDone }: { mark: MapMark; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Видалити мітку «${mark.title}» з карти?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMapMark(mark.id);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <MarkForm initial={mark} onSaved={onDone} />
      <div className="flex flex-col gap-2 px-5 pb-32 pt-2">
        {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void remove()} className="dl-btn-danger">
          Видалити мітку
        </button>
      </div>
    </div>
  );
}

'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { LatLng } from '@/lib/geo';

export type PosMessage = { user_id: string; lat: number; lng: number; accuracy: number | null; ts: number };
export type PresenceUser = { user_id: string; nickname: string; avatar: string };
export type TreasureChange = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: { id?: string; title?: string; is_found?: boolean; found_by?: string | null };
};

type Handlers = {
  onPosition: (m: PosMessage) => void;
  onOnline: (users: PresenceUser[]) => void;
  onTreasuresChanged: (change: TreasureChange) => void;
  onStatus: (connected: boolean) => void;
};

export type GameConnection = {
  sendPosition: (p: LatLng, accuracy: number | null) => void;
  close: () => void;
};

const CHANNEL = 'lost-game';
const MAX_BACKOFF_MS = 10_000;

// One global channel for everyone. Positions use Broadcast; presence is online state only;
// found events come from Postgres Changes (spec §7). Reconnects with backoff capped at 10 s.
export function openGameConnection(opts: Handlers & { me: PresenceUser }): GameConnection {
  let channel: RealtimeChannel | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    const ch = supabase.channel(CHANNEL, {
      config: { broadcast: { self: false }, presence: { key: opts.me.user_id } },
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => opts.onPosition(payload as PosMessage))
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<PresenceUser>();
        opts.onOnline(Object.values(state).flat());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treasures' }, (payload) =>
        opts.onTreasuresChanged({ eventType: payload.eventType as TreasureChange['eventType'], new: (payload.new ?? {}) as TreasureChange['new'] }),
      )
      .subscribe(async (status) => {
        if (ch !== channel) return; // a replaced channel reports its own close
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          opts.onStatus(true);
          await ch.track(opts.me);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          opts.onStatus(false);
          scheduleReconnect();
        }
      });
    channel = ch;
  }

  function scheduleReconnect() {
    if (closed || retryTimer) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    attempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      // Detach before removing: the old channel's CLOSED callback must not schedule another retry (F7).
      const old = channel;
      channel = null;
      if (old) supabase.removeChannel(old);
      connect();
    }, delay);
  }

  connect();

  return {
    sendPosition(p, accuracy) {
      const payload: PosMessage = { user_id: opts.me.user_id, lat: p.lat, lng: p.lng, accuracy, ts: Date.now() };
      channel?.send({ type: 'broadcast', event: 'pos', payload });
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
      channel = null;
    },
  };
}

// Groups treasure pins that would overlap on the screen, so their labels do not sit on each other.
// Points are in screen pixels (already projected). The greedy pass takes the first ungrouped point and gathers every
// ungrouped point within radiusPx of it. Pure, so it can be tested without a map.

export type PinPoint = { id: string; x: number; y: number; lat: number; lng: number };
export type PinGroup = { ids: string[]; lat: number; lng: number };

export function clusterPins(points: PinPoint[], radiusPx: number): PinGroup[] {
  const used = new Set<string>();
  const groups: PinGroup[] = [];
  const r2 = radiusPx * radiusPx;
  for (const seed of points) {
    if (used.has(seed.id)) continue;
    used.add(seed.id);
    const members: PinPoint[] = [seed];
    for (const other of points) {
      if (used.has(other.id)) continue;
      const dx = other.x - seed.x;
      const dy = other.y - seed.y;
      if (dx * dx + dy * dy <= r2) {
        used.add(other.id);
        members.push(other);
      }
    }
    groups.push({
      ids: members.map((m) => m.id),
      lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
      lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
    });
  }
  return groups;
}

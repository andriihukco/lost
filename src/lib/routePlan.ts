import { haversineM, type LatLng } from '@/lib/geo';

// Up to this many stops the best order is found exactly (Held-Karp dynamic programming).
// Above it, nearest neighbour is improved with 2-opt: close to optimal, fast on a phone.
export const EXACT_LIMIT = 9;

// Length of a walk: start, then the points in the given order.
export function pathLengthM(start: LatLng, points: LatLng[]): number {
  let total = 0;
  let prev = start;
  for (const p of points) {
    total += haversineM(prev, p);
    prev = p;
  }
  return total;
}

// Returns the indices of `points` in the order to visit them, starting from `start`.
export function optimalOrder(start: LatLng, points: LatLng[]): number[] {
  const n = points.length;
  if (n === 0) return [];
  return n <= EXACT_LIMIT ? exactOrder(start, points) : heuristicOrder(start, points);
}

function exactOrder(start: LatLng, pts: LatLng[]): number[] {
  const n = pts.length;
  const full = 1 << n;
  const d = (i: number, j: number) => haversineM(pts[i], pts[j]);
  const s = (i: number) => haversineM(start, pts[i]);
  // best[mask][last] = shortest walk from start that visits `mask` and ends at `last`
  const best: number[][] = Array.from({ length: full }, () => new Array<number>(n).fill(Infinity));
  const from: number[][] = Array.from({ length: full }, () => new Array<number>(n).fill(-1));
  for (let i = 0; i < n; i++) best[1 << i][i] = s(i);
  for (let mask = 1; mask < full; mask++) {
    for (let last = 0; last < n; last++) {
      const cur = best[mask][last];
      if (!Number.isFinite(cur) || !(mask & (1 << last))) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const nm = mask | (1 << next);
        const cand = cur + d(last, next);
        if (cand < best[nm][next]) {
          best[nm][next] = cand;
          from[nm][next] = last;
        }
      }
    }
  }
  const all = full - 1;
  let end = 0;
  for (let i = 1; i < n; i++) if (best[all][i] < best[all][end]) end = i;
  const order: number[] = [];
  let mask = all;
  let cur = end;
  while (cur !== -1) {
    order.push(cur);
    const prev = from[mask][cur];
    mask &= ~(1 << cur);
    cur = prev;
  }
  return order.reverse();
}

function heuristicOrder(start: LatLng, pts: LatLng[]): number[] {
  const left = new Set(pts.map((_, i) => i));
  const order: number[] = [];
  let at = start;
  while (left.size > 0) {
    let bestI = -1;
    let bestD = Infinity;
    for (const i of left) {
      const dd = haversineM(at, pts[i]);
      if (dd < bestD) {
        bestD = dd;
        bestI = i;
      }
    }
    order.push(bestI);
    left.delete(bestI);
    at = pts[bestI];
  }
  // 2-opt on the open path: reverse a segment while that shortens the walk
  const coords = (ix: number[]) => ix.map((i) => pts[i]);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathLengthM(start, coords(cand)) + 1e-6 < pathLengthM(start, coords(order))) {
          order.splice(0, order.length, ...cand);
          improved = true;
        }
      }
    }
  }
  return order;
}

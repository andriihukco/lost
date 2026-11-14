import { expect, test } from 'vitest';
import { haversineM } from '@/lib/geo';
import { MAP_PAD_M, viewBounds } from '@/lib/mapBounds';

const kyiv = { lat: 49.8419, lng: 24.0315 };

test('no points means no limit', () => {
  expect(viewBounds([], MAP_PAD_M)).toBeNull();
});

test('one point gets a box padded by the given distance on every side', () => {
  const b = viewBounds([kyiv], 2500)!;
  expect(haversineM({ lat: b.north, lng: kyiv.lng }, kyiv)).toBeGreaterThan(2450);
  expect(haversineM({ lat: b.north, lng: kyiv.lng }, kyiv)).toBeLessThan(2550);
  expect(haversineM({ lat: b.south, lng: kyiv.lng }, kyiv)).toBeGreaterThan(2450);
  expect(haversineM({ lat: kyiv.lat, lng: b.east }, kyiv)).toBeGreaterThan(2450);
  expect(haversineM({ lat: kyiv.lat, lng: b.west }, kyiv)).toBeLessThan(2550);
});

test('the box contains every point, and grows from the outermost ones', () => {
  const pts = [kyiv, { lat: 49.87, lng: 24.1 }, { lat: 49.81, lng: 23.97 }];
  const b = viewBounds(pts, 2500)!;
  for (const p of pts) {
    expect(p.lat).toBeGreaterThanOrEqual(b.south);
    expect(p.lat).toBeLessThanOrEqual(b.north);
    expect(p.lng).toBeGreaterThanOrEqual(b.west);
    expect(p.lng).toBeLessThanOrEqual(b.east);
  }
  expect(haversineM({ lat: b.north, lng: 24.1 }, { lat: 49.87, lng: 24.1 })).toBeGreaterThan(2450);
});

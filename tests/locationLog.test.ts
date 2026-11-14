import { expect, test } from 'vitest';
import { shouldLogLocation, LOG_MIN_MOVE_M, LOG_MAX_GAP_MS } from '@/lib/locationLog';

test('logs the first fix', () => {
  expect(shouldLogLocation(null, { lat: 49.8, lng: 24.0 }, -Infinity, 0)).toBe(true);
});
test('does not log a small move within the gap', () => {
  expect(shouldLogLocation({ lat: 49.8, lng: 24.0 }, { lat: 49.80005, lng: 24.0 }, 0, 5_000)).toBe(false);
});
test('logs after moving at least 10 m', () => {
  // 0.0001 deg latitude is about 11 m
  expect(shouldLogLocation({ lat: 49.8, lng: 24.0 }, { lat: 49.8001, lng: 24.0 }, 0, 5_000)).toBe(true);
});
test('logs after the max gap even when standing still', () => {
  expect(shouldLogLocation({ lat: 49.8, lng: 24.0 }, { lat: 49.8, lng: 24.0 }, 0, LOG_MAX_GAP_MS)).toBe(true);
});
test('constants are the agreed values', () => {
  expect(LOG_MIN_MOVE_M).toBe(10);
  expect(LOG_MAX_GAP_MS).toBe(30_000);
});

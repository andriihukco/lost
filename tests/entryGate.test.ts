import { expect, test } from 'vitest';
import { compassPermOf, firstGateStep } from '@/lib/entryGate';

test('a first-time player starts at the intro, whatever the permissions say', () => {
  expect(firstGateStep(false, 'granted', 'granted')).toBe('intro');
});
test('a returning player with location granted and compass granted goes straight in', () => {
  expect(firstGateStep(true, 'granted', 'granted')).toBeNull();
});
test('a returning player whose location was revoked is sent back to location', () => {
  expect(firstGateStep(true, 'denied', 'granted')).toBe('location');
});
test('location not yet granted sends the player to location', () => {
  expect(firstGateStep(true, 'prompt', 'granted')).toBe('location');
});
test('an iPhone compass that needs a tap sends the player to compass', () => {
  expect(firstGateStep(true, 'granted', 'prompt')).toBe('compass');
});
test('a denied compass sends the player to compass', () => {
  expect(firstGateStep(true, 'granted', 'denied')).toBe('compass');
});
test('a device without a compass (desktop) does not block entry', () => {
  expect(firstGateStep(true, 'granted', 'unavailable')).toBeNull();
});
test('a browser that cannot report its location permission does not block entry', () => {
  expect(firstGateStep(true, 'unknown', 'granted')).toBeNull();
});
test('location is checked before the compass', () => {
  expect(firstGateStep(true, 'denied', 'prompt')).toBe('location');
});

test('a compass that is listening counts as granted', () => {
  expect(compassPermOf('listening')).toBe('granted');
});
test('a compass that needs a tap counts as prompt', () => {
  expect(compassPermOf('needs-permission')).toBe('prompt');
});
test('a compass the player refused counts as denied', () => {
  expect(compassPermOf('denied')).toBe('denied');
});
test('no compass on this device counts as unavailable', () => {
  expect(compassPermOf('unsupported')).toBe('unavailable');
});

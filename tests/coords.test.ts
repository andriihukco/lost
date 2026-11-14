import { expect, test } from 'vitest';
import { parseCoordinates } from '@/lib/coords';

test.each([
  ['49.8419, 24.0315', { lat: 49.8419, lng: 24.0315 }],
  ['49.8419,24.0315', { lat: 49.8419, lng: 24.0315 }],
  ['49,8419, 24,0315', { lat: 49.8419, lng: 24.0315 }],
  ['49.8419 24.0315', { lat: 49.8419, lng: 24.0315 }],
  ['https://www.google.com/maps/@49.8419,24.0315,17z', { lat: 49.8419, lng: 24.0315 }],
  ['https://www.google.com/maps?q=49.8419,24.0315', { lat: 49.8419, lng: 24.0315 }],
  ['https://maps.apple.com/?ll=49.8419,24.0315', { lat: 49.8419, lng: 24.0315 }],
])('parses %s', (input, expected) => {
  expect(parseCoordinates(input)).toEqual(expected);
});

test.each(['', '49.8', '91, 24', '49, 181', 'hello', 'https://maps.app.goo.gl/abc'])(
  'rejects %s', (input) => { expect(parseCoordinates(input)).toBeNull(); },
);

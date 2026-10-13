import { describe, expect, it } from 'vitest';
import { parseDateBoundary } from './dateBoundaries';

describe('parseDateBoundary', () => {
  it('parses date-only values at the local start and end of the day', () => {
    expect(parseDateBoundary('2026-12-18', 'start')).toEqual(new Date(2026, 11, 18, 0, 0, 0, 0));
    expect(parseDateBoundary('2026-12-18', 'end')).toEqual(new Date(2026, 11, 18, 23, 59, 59, 999));
  });

  it('preserves the exact time and timezone of a timestamp', () => {
    const timestamp = '2026-12-18T17:45:30.123Z';

    expect(parseDateBoundary(timestamp).toISOString()).toBe(timestamp);
  });

  it('copies Date objects without changing their time', () => {
    const value = new Date(2026, 11, 18, 15, 0, 0, 456);
    const parsed = parseDateBoundary(value);

    expect(parsed).toEqual(value);
    expect(parsed).not.toBe(value);
  });

  it('returns null for invalid or empty input', () => {
    expect(parseDateBoundary('not-a-date')).toBeNull();
    expect(parseDateBoundary('')).toBeNull();
    expect(parseDateBoundary(null)).toBeNull();
  });
});

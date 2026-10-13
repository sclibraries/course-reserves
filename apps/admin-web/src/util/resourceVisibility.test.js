import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLinkVisible, isPrimaryLinkVisible } from './resourceVisibility';

describe('visibility date boundaries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps date-only end dates visible through the local calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));

    expect(isLinkVisible({
      use_link_visibility: '1',
      end_visibility: '2026-08-22',
    }, false)).toBe(true);
    expect(isPrimaryLinkVisible({
      use_primary_link_visibility: '1',
      primary_link_end_visibility: '2026-08-22',
    }, false)).toBe(true);
  });

  it('preserves exact end-time semantics for timestamp values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T16:00:00.000Z'));

    expect(isLinkVisible({
      use_link_visibility: '1',
      end_visibility: '2026-08-22T15:59:59.000Z',
    }, false)).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatVisibilityDate,
  getItemVisibility,
  getVisibleLinks,
  isItemVisible,
  isLinkVisible,
  isPrimaryLinkVisible,
} from './resourceVisibility';

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

describe('course item visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows authorized viewers to bypass resource visibility dates', () => {
    const item = {
      isElectronic: true,
      resource: { start_visibility: '2099-01-01' },
    };

    expect(isItemVisible(item, true)).toBe(true);
  });

  it('keeps electronic resources with no visibility dates visible', () => {
    const item = { isElectronic: true, resource: {} };

    expect(isItemVisible(item, false)).toBe(true);
  });

  it('hides an electronic resource before its start date', () => {
    const item = {
      isElectronic: true,
      resource: { start_visibility: '2099-01-01' },
    };

    expect(isItemVisible(item, false)).toBe(false);
  });

  it('hides an electronic resource after its end date', () => {
    const item = {
      isElectronic: true,
      resource: { end_visibility: '2026-08-21' },
    };

    expect(isItemVisible(item, false)).toBe(false);
  });

  it('keeps an electronic resource visible through the last local day of its end date', () => {
    const item = {
      isElectronic: true,
      resource: { end_visibility: '2026-08-22' },
    };

    expect(isItemVisible(item, false)).toBe(true);
  });

  it('filters additional links using the shared visibility rule', () => {
    const hiddenLink = {
      use_link_visibility: '1',
      start_visibility: '2099-01-01',
    };
    const visibleLink = { title: 'test-visible-link' };

    expect(getVisibleLinks([hiddenLink, visibleLink], false)).toEqual([visibleLink]);
    expect(getVisibleLinks([hiddenLink, visibleLink], true)).toEqual([hiddenLink, visibleLink]);
  });

  it('formats a parsed visibility boundary as a local date', () => {
    const expected = new Date(2026, 7, 22, 23, 59, 59, 999).toLocaleDateString();

    expect(formatVisibilityDate('2026-08-22', 'end')).toBe(expected);
  });

  it('includes the availability message and start boundary for a hidden item', () => {
    const startDate = new Date(2026, 7, 23, 0, 0, 0, 0);
    const item = {
      isElectronic: true,
      resource: { start_visibility: '2026-08-23' },
    };

    expect(getItemVisibility(item, false)).toEqual({
      isVisible: false,
      message: `Available from ${startDate.toLocaleDateString()}`,
      startDate,
    });
  });

  it('includes the availability message and end boundary for an expired item', () => {
    const endDate = new Date(2026, 7, 21, 23, 59, 59, 999);
    const item = {
      isElectronic: true,
      resource: { end_visibility: '2026-08-21' },
    };

    expect(getItemVisibility(item, false)).toEqual({
      isVisible: false,
      message: `Available until ${endDate.toLocaleDateString()}`,
      endDate,
    });
  });
});

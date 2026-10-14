import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVisibilityCounts } from './getVisibilityCounts';

describe('getVisibilityCounts', () => {
  afterEach(() => vi.useRealTimers());

  it('counts hidden records and selects the earliest upcoming start date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 12));
    const records = [
      { isElectronic: true, resource: { start_visibility: '2026-02-15' } },
      { isElectronic: true, resource: { start_visibility: '2026-02-01' } },
      { isElectronic: true, resource: { end_visibility: '2026-01-10' } },
      { isElectronic: false, resource: null },
    ];

    expect(getVisibilityCounts(records, false)).toEqual({
      hiddenCount: 3,
      visibleCount: 1,
      totalCount: 4,
      nextAvailableDate: new Date(2026, 1, 1),
    });
  });

  it('treats all records as visible when visibility is bypassed', () => {
    const records = [
      { isElectronic: true, resource: { start_visibility: '2099-01-01' } },
      { isElectronic: false, resource: null },
    ];

    expect(getVisibilityCounts(records, true)).toEqual({
      hiddenCount: 0,
      visibleCount: 2,
      totalCount: 2,
      nextAvailableDate: null,
    });
  });
});

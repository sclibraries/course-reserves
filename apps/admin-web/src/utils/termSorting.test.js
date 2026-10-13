import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentTerm, sortTerms } from './termSorting';

describe('getCurrentTerm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 18, 15, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the single active term in public mode', () => {
    const activeTerm = {
      name: '2026 Fall',
      startDate: '2026-09-01',
      endDate: '2026-12-20',
    };

    expect(getCurrentTerm([activeTerm], 'public')).toBe(activeTerm);
  });

  it('chooses the active term ending earliest in public mode', () => {
    const laterEndingTerm = {
      name: '2027 Winter',
      startDate: '2026-10-01',
      endDate: '2026-12-30',
    };
    const soonerEndingTerm = {
      name: '2026 Fall',
      startDate: '2026-09-01',
      endDate: '2026-12-20',
    };

    expect(getCurrentTerm([laterEndingTerm, soonerEndingTerm], 'public')).toBe(soonerEndingTerm);
  });

  it('returns the next upcoming term when none is active', () => {
    const mostRecentByName = {
      name: '2026 Fall',
      startDate: '2026-08-01',
      endDate: '2026-12-17',
    };
    const upcomingTerm = {
      name: '2025 Spring',
      startDate: '2027-01-15',
      endDate: '2027-05-15',
    };

    expect(getCurrentTerm([mostRecentByName, upcomingTerm], 'public')).toBe(upcomingTerm);
  });

  it('chooses the upcoming term with the earliest start date', () => {
    const laterUpcomingTerm = {
      name: '2026 Spring',
      startDate: '2027-01-20',
      endDate: '2027-05-15',
    };
    const soonerUpcomingTerm = {
      name: '2025 Fall',
      startDate: '2027-01-05',
      endDate: '2027-05-15',
    };

    expect(getCurrentTerm([laterUpcomingTerm, soonerUpcomingTerm], 'public')).toBe(soonerUpcomingTerm);
  });

  it('falls back to the most recent past term by sortTerms', () => {
    const pastTerms = [
      { name: '2025 Fall', startDate: '2025-09-01', endDate: '2025-12-20' },
      { name: '2026 Spring', startDate: '2026-01-15', endDate: '2026-05-15' },
    ];

    expect(getCurrentTerm(pastTerms, 'public')).toBe(sortTerms(pastTerms)[0]);
  });

  it('uses sortTerms when terms do not have dates', () => {
    const undatedTerms = [
      { name: '2025 Fall' },
      { name: '2026 Spring' },
    ];

    expect(getCurrentTerm(undatedTerms, 'public')).toBe(sortTerms(undatedTerms)[0]);
  });

  it('returns null for empty or null input', () => {
    expect(getCurrentTerm([], 'public')).toBeNull();
    expect(getCurrentTerm(null, 'public')).toBeNull();
  });

  it('chooses the active term ending latest in admin mode', () => {
    const soonerEndingTerm = {
      name: '2026 Fall',
      startDate: '2026-09-01',
      endDate: '2026-12-20',
    };
    const laterEndingTerm = {
      name: '2027 Winter',
      startDate: '2026-10-01',
      endDate: '2026-12-30',
    };

    expect(getCurrentTerm([soonerEndingTerm, laterEndingTerm], 'admin')).toBe(laterEndingTerm);
  });

  it('keeps a term active through the last local day of its end date', () => {
    const endingToday = {
      name: '2026 Fall',
      startDate: '2026-09-01',
      endDate: '2026-12-18',
    };
    const nextTerm = {
      name: '2027 Winter',
      startDate: '2027-01-05',
      endDate: '2027-05-15',
    };

    expect(getCurrentTerm([endingToday, nextTerm], 'public')).toBe(endingToday);
  });

  it('keeps a term active from the first local day of its start date', () => {
    vi.setSystemTime(new Date(2026, 11, 18, 0, 30));
    const startingToday = {
      name: '2026 Fall',
      startDate: '2026-12-18',
      endDate: '2026-12-20',
    };

    expect(getCurrentTerm([startingToday], 'public')).toBe(startingToday);
  });
});

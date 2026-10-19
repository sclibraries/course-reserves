import { describe, expect, it } from 'vitest';
import type { Term } from '@/store/termsStore';
import { compareTermNames, compareTerms, getSeasonOrder, parseTermName } from './termUtils';

const makeTerm = (name: string): Term => ({
  id: name,
  name,
  startDate: '',
  endDate: '',
});

describe('termUtils', () => {
  it('parses season-first and year-first term names with the same return shape', () => {
    expect(parseTermName('Spring 2026')).toEqual({ year: 2026, season: 'Spring', full: 'Spring 2026' });
    expect(parseTermName('2026 Spring')).toEqual({ year: 2026, season: 'Spring', full: '2026 Spring' });
  });

  it('maps January, Interterm, and Winter to the first seasonal position', () => {
    for (const termName of ['January 2026', '2026 Interterm', 'Winter 2026']) {
      expect(parseTermName(termName)?.season).toBe('Winter');
    }
    expect(getSeasonOrder('January')).toBe(0);
    expect(getSeasonOrder('Interterm')).toBe(0);
    expect(getSeasonOrder('Winter')).toBe(0);
  });

  it('compares term names in seasonal order and returns null when either term is unparseable', () => {
    expect(compareTermNames('January 2026', 'Spring 2026')).toBeLessThan(0);
    expect(compareTermNames('Interterm 2026', 'Spring 2026')).toBeLessThan(0);
    expect(compareTermNames('Winter 2026', 'Spring 2026')).toBeLessThan(0);
    expect(compareTermNames('Spring 2026', 'Summer 2026')).toBeLessThan(0);
    expect(compareTermNames('Summer 2026', 'Fall 2026')).toBeLessThan(0);
    expect(compareTermNames('Spring 2027', 'Fall 2026')).toBeGreaterThan(0);
    expect(compareTermNames('Fall 2026', 'Fall 2026')).toBe(0);
    expect(compareTermNames('Spring 2026', 'Unknown Term')).toBeNull();
  });

  it('orders mixed-format term names chronologically for existing term-list callers', () => {
    const terms = [
      makeTerm('Fall 2026'),
      makeTerm('Spring 2026'),
      makeTerm('2026 Winter'),
      makeTerm('Summer 2026'),
    ];

    expect(terms.sort(compareTerms).map((term) => term.name)).toEqual([
      '2026 Winter',
      'Spring 2026',
      'Summer 2026',
      'Fall 2026',
    ]);
  });

  it('leaves unparseable term names unsupported for chronological comparison', () => {
    expect(parseTermName('Special Session')).toBeNull();
    expect(compareTermNames('Special Session', 'Fall 2026')).toBeNull();
  });
});

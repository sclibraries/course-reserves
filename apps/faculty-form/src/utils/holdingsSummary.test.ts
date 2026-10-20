import { describe, expect, it } from 'vitest';
import { isHeldElectronically, isPhysicalRecord, summarizeCopies } from './holdingsSummary';
import type { DiscoverySearchResult } from '@/services/discoverySearchService';
import type { CatalogAvailability } from '@/services/catalogAvailabilityApi';

function result(overrides: Partial<DiscoverySearchResult> = {}): DiscoverySearchResult {
  return {
    id: 'synthetic-an',
    dbId: 'synthetic-database',
    title: 'Synthetic record',
    authors: [],
    publicationType: 'Book',
    database: 'Synthetic database',
    pLink: '',
    hasFullText: false,
    ...overrides,
  };
}

describe('holdings summary rules', () => {
  it.each(['Book', 'Audio', 'Video', 'Music Score', 'Map', 'Kit', 'Realia'])(
    'treats %s as physical catalog material',
    (publicationType) => {
      expect(isPhysicalRecord(result({ publicationType }))).toBe(true);
    },
  );

  it.each(['eBook', 'Electronic Resource', 'Academic Journal'])(
    'does not treat %s as physical catalog material',
    (publicationType) => {
      expect(isPhysicalRecord(result({ publicationType }))).toBe(false);
    },
  );

  it.each([
    ['EDS full text', result({ hasFullText: true }), true],
    ['a Smith local accession', result({ id: 'smc.synthetic.dda-book' }), true],
    ['the Smith catalog database', result({ dbId: 'cat09114a', publicationType: 'eBook' }), true],
    ['a Smith EDS holding', result({ holdings: [{ Sublocation: 'Smith College Online', ShelfLocator: 'JSTOR DDA' }] }), true],
    ['another college online holding', result({ holdings: [{ Sublocation: 'Mount Holyoke College Online', ShelfLocator: 'JSTOR' }] }), false],
  ])('recognizes Smith online access for %s', (_description, record, expected) => {
    expect(isHeldElectronically(record)).toBe(expected);
  });

  it.each([
    ['checking', undefined, true, false, 'Checking availability…', 'checking'],
    ['available at Smith', {
      instanceId: 'synthetic-instance',
      copies: [
        { library: 'SC Neilson Library', location: 'Smith College Neilson Stacks', callNumber: 'QA 76 .A1', status: 'Available', loanType: 'Standard Loan' },
        { library: 'Mount Holyoke College Library', location: 'Mount Holyoke College Main Stacks', callNumber: 'QA 76 .A1', status: 'Available', loanType: 'Standard Loan' },
      ],
    }, false, false, 'Available at Smith · Neilson Stacks', 'available'],
    ['checked out at Smith', {
      instanceId: 'synthetic-instance',
      copies: [
        { library: 'SC Neilson Library', location: 'Smith College Neilson Stacks', callNumber: 'QA 76 .A1', status: 'Checked out', loanType: 'Standard Loan' },
        { library: 'Mount Holyoke College Library', location: 'Mount Holyoke College Main Stacks', callNumber: 'QA 76 .A1', status: 'Available', loanType: 'Standard Loan' },
      ],
    }, false, false, 'Checked out at Smith', 'checked-out'],
    ['available elsewhere', {
      instanceId: 'synthetic-instance',
      copies: [{ library: 'Mount Holyoke College Library', location: 'Mount Holyoke College Main Stacks', callNumber: 'QA 76 .A1', status: 'Available', loanType: 'Standard Loan' }],
    }, false, false, 'Available at Mount Holyoke', 'other-college'],
    ['held elsewhere without an available copy', {
      instanceId: 'synthetic-instance',
      copies: [{ library: 'Mount Holyoke College Library', location: 'Mount Holyoke College Main Stacks', callNumber: 'QA 76 .A1', status: 'Checked out', loanType: 'Standard Loan' }],
    }, false, false, 'Held at Mount Holyoke · Checked out', 'other-college'],
    ['not held', { instanceId: 'synthetic-instance', copies: [] }, false, false, 'Not held by the Five Colleges', 'not-held'],
    ['failed', { instanceId: 'synthetic-instance', error: true, reference: 'synthetic-reference' }, false, false, 'Availability unavailable right now', 'error'],
    ['request failure', undefined, false, true, 'Availability unavailable right now', 'error'],
  ])('summarizes %s copies', (_description, availability, loading, failed, label, tone) => {
    expect(summarizeCopies(availability as CatalogAvailability | undefined, loading, failed)).toEqual({ label, tone });
  });
});

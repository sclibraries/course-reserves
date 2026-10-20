import type { CatalogAvailability, CatalogAvailabilityCopy } from '@/services/catalogAvailabilityApi';
import type { DiscoverySearchResult, EDSHoldingCopy } from '@/services/discoverySearchService';

const PHYSICAL_PUBLICATION_TYPES = new Set([
  'book',
  'audio',
  'video',
  'music score',
  'map',
  'kit',
  'realia',
]);

export type HoldingsTone = 'checking' | 'available' | 'checked-out' | 'other-college' | 'not-held' | 'error';

export interface HoldingsSummary {
  label: string;
  tone: HoldingsTone;
}

export function isPhysicalRecord(record: Pick<DiscoverySearchResult, 'publicationType'>): boolean {
  return PHYSICAL_PUBLICATION_TYPES.has(record.publicationType.trim().toLowerCase());
}

export function isHeldElectronically(record: Pick<DiscoverySearchResult, 'id' | 'dbId' | 'hasFullText' | 'holdings'>): boolean {
  return Boolean(
    record.hasFullText
    || record.dbId.toLowerCase() === 'cat09114a'
    || record.id.toLowerCase().startsWith('smc.')
    || record.holdings?.some(isSmithEdsHolding),
  );
}

export function summarizeCopies(
  availability?: CatalogAvailability,
  loading = false,
  failed = false,
): HoldingsSummary {
  if (availability?.error || (failed && !availability)) {
    return { label: 'Availability unavailable right now', tone: 'error' };
  }
  if (loading || !availability) return { label: 'Checking availability…', tone: 'checking' };

  const copies = availability.copies || [];
  const smithCopies = copies.filter(isSmithCopy);
  const availableSmithCopy = smithCopies.find(isAvailable);
  if (availableSmithCopy) {
    const location = availableSmithCopy.location?.replace(/^Smith College\s*/i, '').trim()
      || availableSmithCopy.location
      || 'location unavailable';
    return { label: 'Available at Smith · ' + location, tone: 'available' };
  }
  if (smithCopies.length > 0) return { label: 'Checked out at Smith', tone: 'checked-out' };
  if (copies.length === 0) return { label: 'Not held by the Five Colleges', tone: 'not-held' };

  const availableCopy = copies.find(isAvailable);
  if (availableCopy) {
    return {
      label: 'Available at ' + collegeName(availableCopy),
      tone: 'other-college',
    };
  }
  return {
    label: 'Held at ' + collegeName(copies[0]) + ' · ' + (copies[0].status || 'Status unavailable'),
    tone: 'other-college',
  };
}

export function sortSmithFirstCopies<T extends CatalogAvailabilityCopy>(copies: T[]): T[] {
  return [...copies.filter(isSmithCopy), ...copies.filter((copy) => !isSmithCopy(copy))];
}

export function sortSmithFirstEdsHoldings<T extends EDSHoldingCopy>(holdings: T[]): T[] {
  return [...holdings.filter(isSmithEdsHolding), ...holdings.filter((holding) => !isSmithEdsHolding(holding))];
}

function isSmithCopy(copy: Pick<CatalogAvailabilityCopy, 'library' | 'location'>): boolean {
  return /smith|^sc(?:\s|$)/i.test((copy.library || '') + ' ' + (copy.location || ''));
}

function isSmithEdsHolding(holding: EDSHoldingCopy): boolean {
  return holding.Sublocation?.trim().toLowerCase().startsWith('smith college') || false;
}

function isAvailable(copy: Pick<CatalogAvailabilityCopy, 'status'>): boolean {
  return copy.status?.toLowerCase() === 'available';
}

function collegeName(copy: CatalogAvailabilityCopy): string {
  const location = ((copy.location || '') + ' ' + (copy.library || '')).toLowerCase();
  if (location.includes('mount holyoke')) return 'Mount Holyoke';
  if (location.includes('hampshire')) return 'Hampshire';
  if (location.includes('amherst')) return 'Amherst';
  if (location.includes('umass') || location.includes('university of massachusetts')) return 'UMass Amherst';
  return 'another Five College library';
}

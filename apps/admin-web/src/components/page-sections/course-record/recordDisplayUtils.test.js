import { describe, expect, it } from 'vitest';
import {
  formatPublicationEntries,
  getDiscoverUrl,
  getHoldingUrl,
  getReserveMaterialTypes,
  getResourceBadgeText,
  isProxyEnabled,
  sortHoldings,
} from './recordDisplayUtils';

describe('record display helpers', () => {
  it('builds a catalog URL from the base URL and instance ID', () => {
    expect(getDiscoverUrl('https://catalog.test/item/', 'test-instance-123'))
      .toBe('https://catalog.test/item/test.instance.123');
    expect(getDiscoverUrl('', 'test-instance-123')).toBeNull();
    expect(getDiscoverUrl('https://catalog.test/item/', '')).toBeNull();
  });

  it('formats publication entries in display order', () => {
    expect(formatPublicationEntries([
      { publisher: 'test-publisher', place: 'test-place', dateOfPublication: '2025' },
      { publisher: 'test-second-publisher' },
    ])).toBe('test-publisher; test-place; 2025 / test-second-publisher');
  });

  it('recognizes only the string one as a proxied link', () => {
    expect(isProxyEnabled({ use_proxy: '1' })).toBe(true);
    expect(isProxyEnabled({ use_proxy: 1 })).toBe(false);
  });

  it('sorts holdings by volume, copy number, then barcode', () => {
    const holdings = [
      { id: 'test-volume-two', volume: 'Volume 2', itemCopyNumber: '1', barcode: 'a' },
      { id: 'test-copy-two', volume: 'Volume 1', itemCopyNumber: '2', barcode: 'a' },
      { id: 'test-barcode-b', volume: 'Volume 1', itemCopyNumber: '1', barcode: 'b' },
      { id: 'test-barcode-a', volume: 'Volume 1', itemCopyNumber: '1', barcode: 'a' },
    ];

    expect(sortHoldings(holdings).map(holding => holding.id)).toEqual([
      'test-barcode-a',
      'test-barcode-b',
      'test-copy-two',
      'test-volume-two',
    ]);
  });

  it('uses a copied item URL when a holding has no URL of its own', () => {
    const copiedItem = { barcode: 'test-barcode', uri: 'https://catalog.test/copied' };

    expect(getHoldingUrl({ barcode: 'test-barcode' }, copiedItem))
      .toBe('https://catalog.test/copied');
    expect(getHoldingUrl({ uri: 'https://catalog.test/holding' }, copiedItem))
      .toBe('https://catalog.test/holding');
    expect(getHoldingUrl({ barcode: 'other-barcode' }, copiedItem)).toBe('');
  });

  it('filters reserve material types and removes duplicate names', () => {
    const holdings = [
      { location: 'Main Reserves', materialType: { name: 'Book' } },
      { location: 'Course Reserve', materialType: { name: 'Book' } },
      { location: 'Main Reserves', materialType: { name: 'Admin Only' } },
      { location: 'Stacks', materialType: { name: 'DVD' } },
    ];

    expect(getReserveMaterialTypes(false, holdings)).toEqual(['Book']);
    expect(getReserveMaterialTypes(true, holdings)).toEqual([]);
  });

  it('chooses the resource badge text for electronic, physical, or reserve items', () => {
    expect(getResourceBadgeText(true, [])).toBe('Electronic Resource');
    expect(getResourceBadgeText(false, [])).toBe('Physical Resource');
    expect(getResourceBadgeText(false, ['Book', 'DVD'])).toBe('Book / DVD');
  });
});

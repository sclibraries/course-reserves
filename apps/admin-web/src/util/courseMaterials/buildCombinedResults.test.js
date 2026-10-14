import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCombinedResults } from './buildCombinedResults';

const item = (id, title, options = {}) => ({
  id,
  order: options.order,
  folder_id: options.folderId,
  folder_name: options.folderName,
  isElectronic: options.isElectronic || false,
  resource: options.resource || null,
  copiedItem: { title, contributors: options.contributors || [] },
});

describe('buildCombinedResults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps the server ordering while grouping folders when no electronic resources exist', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const records = [
      item('test-folder', 'Folder item', { folderId: 'test-folder-id', folderName: 'Test folder' }),
      item('test-print', 'Print item'),
    ];

    expect(buildCombinedResults(records, 'all', '', false)).toEqual([
      { folder: 'Test folder', items: [records[0]] },
      records[1],
    ]);
  });

  it('filters by type and search, then uses explicit resource order', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const records = [
      item('test-electronic', 'Test algebra', {
        order: '2', isElectronic: true, folderId: 'test-readings', folderName: 'Readings',
        contributors: [{ name: 'Test Author' }],
      }),
      item('test-print', 'Test calculus', { order: 1 }),
      item('test-other', 'Other item', { order: 0 }),
    ];

    expect(buildCombinedResults(records, 'electronic', 'author', false)).toEqual([
      { folder: 'Readings', items: [records[0]] },
    ]);
    expect(buildCombinedResults(records, 'all', '', false)).toEqual([
      records[2], records[1], { folder: 'Readings', items: [records[0]] },
    ]);
  });

  it('hides date-restricted items unless the caller can bypass visibility', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00'));
    const records = [
      item('test-visible', 'Visible', { isElectronic: true }),
      item('test-future', 'Future', {
        isElectronic: true,
        resource: { start_visibility: '2026-02-01' },
      }),
    ];

    expect(buildCombinedResults(records, 'all', '', false)).toEqual([records[0]]);
    expect(buildCombinedResults(records, 'all', '', true).map(result => result.id)).toEqual([
      'test-future', 'test-visible',
    ]);
  });
});

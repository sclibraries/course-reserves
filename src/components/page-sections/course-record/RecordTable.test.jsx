import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RecordTable, * as RecordTableModule from './RecordTable';

const futureDate = '2099-01-01T00:00:00.000Z';

const visiblePrintRecord = {
  id: 'visible-print-record',
  isElectronic: false,
  copiedItem: { title: 'Visible print resource' },
};

const renderSplitView = (records, canBypassVisibility = false) => renderToStaticMarkup(
  createElement(RecordTable, {
    combinedResults: [visiblePrintRecord, ...records],
    availability: {},
    customization: {},
    hasElectronicReserves: true,
    courseInfo: {},
    collegeParam: 'test-college',
    viewMode: 'split',
    records: [visiblePrintRecord, ...records],
    canBypassVisibility,
  })
);

describe('RecordTable split-view visibility', () => {
  it('honors visibility authority for resources outside their visibility window', () => {
    const records = [{
      id: 'future-resource',
      isElectronic: true,
      copiedItem: { title: 'Future-only resource' },
      resource: { start_visibility: futureDate },
    }];

    expect(renderSplitView(records)).not.toContain('Future-only resource');
    expect(renderSplitView(records, true)).toContain('Future-only resource');
  });

  it('filters inactive additional links using the visibility authority', () => {
    const links = [{
      link_id: 'future-link',
      title: 'Future-only link',
      url: 'https://example.test/future-link',
      use_link_visibility: '1',
      start_visibility: futureDate,
    }];

    expect(RecordTableModule.getVisibleSplitLinks).toBeTypeOf('function');
    expect(RecordTableModule.getVisibleSplitLinks(links, false)).toEqual([]);
    expect(RecordTableModule.getVisibleSplitLinks(links, true)).toEqual(links);
  });
});

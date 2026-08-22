import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RecordTable from './RecordTable';

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

const renderCombinedView = (records, canBypassVisibility = false) => renderToStaticMarkup(
  createElement(RecordTable, {
    combinedResults: records,
    availability: {},
    customization: {},
    hasElectronicReserves: true,
    courseInfo: {},
    collegeParam: 'test-college',
    viewMode: 'combined',
    records,
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

  it('renders only additional-link anchors allowed by student visibility', () => {
    const records = [{
      id: 'split-link-resource',
      isElectronic: true,
      copiedItem: { title: 'Split link resource' },
      resource: {
        links: [
          {
            link_id: 'future-link',
            title: 'Future-only link',
            url: 'https://example.test/future-link',
            use_link_visibility: '1',
            start_visibility: futureDate,
          },
          {
            link_id: 'visible-link',
            title: 'Visible link',
            url: 'https://example.test/visible-link',
          },
        ],
      },
    }];

    const studentMarkup = renderSplitView(records);
    const bypassMarkup = renderSplitView(records, true);

    expect(studentMarkup).not.toContain('https://example.test/future-link');
    expect(studentMarkup).toContain('https://example.test/visible-link');
    expect(bypassMarkup).toContain('https://example.test/future-link');
  });

  it('removes out-of-window resources from combined mode while retaining visible records', () => {
    const records = [
      visiblePrintRecord,
      {
        id: 'combined-future-resource',
        isElectronic: true,
        copiedItem: { title: 'Combined future-only resource' },
        resource: { start_visibility: futureDate },
      },
    ];

    const markup = renderCombinedView(records);

    expect(markup).toContain('Visible print resource');
    expect(markup).not.toContain('Combined future-only resource');
  });
});

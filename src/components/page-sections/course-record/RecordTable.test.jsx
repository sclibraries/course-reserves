import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.useRealTimers();
  });

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
            description: 'Future-only split description',
            url: 'https://example.test/future-link',
            use_proxy: '1',
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
    expect(studentMarkup).not.toContain('Future-only link');
    expect(studentMarkup).not.toContain('Future-only split description');
    expect(studentMarkup).not.toContain('Proxy Enabled');
    expect(studentMarkup).not.toContain('Not Currently Available');
    expect(studentMarkup).not.toContain('Link not currently available');
    expect(studentMarkup).toContain('https://example.test/visible-link');
    expect(bypassMarkup).toContain('https://example.test/future-link');
    expect(bypassMarkup).toContain('Future-only split description');
    expect(bypassMarkup).toContain('Link Visibility');
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

  it('removes hidden additional-link metadata and counts only visible links in combined student view', () => {
    const records = [{
      id: 'combined-link-resource',
      isElectronic: true,
      copiedItem: { title: 'Combined link resource' },
      resource: {
        links: [
          {
            link_id: 'combined-hidden-link',
            title: 'Hidden combined title',
            description: 'Hidden combined description',
            url: 'https://example.test/hidden-combined',
            use_proxy: '1',
            use_link_visibility: '1',
            start_visibility: futureDate,
          },
          {
            link_id: 'combined-visible-link',
            title: 'Visible combined title',
            url: 'https://example.test/visible-combined',
          },
        ],
      },
    }];

    const studentMarkup = renderCombinedView(records);
    const staffMarkup = renderCombinedView(records, true);

    expect(studentMarkup).toContain('1 link available');
    expect(studentMarkup).not.toContain('2 links available');
    expect(studentMarkup).not.toContain('Hidden combined title');
    expect(studentMarkup).not.toContain('Hidden combined description');
    expect(studentMarkup).not.toContain('https://example.test/hidden-combined');
    expect(studentMarkup).not.toContain('Proxy Enabled');
    expect(studentMarkup).not.toContain('Not Currently Available');
    expect(studentMarkup).not.toContain('Link not currently available');

    expect(staffMarkup).toContain('2 links available');
    expect(staffMarkup).toContain('Hidden combined title');
    expect(staffMarkup).toContain('Hidden combined description');
    expect(staffMarkup).toContain('https://example.test/hidden-combined');
    expect(staffMarkup).toContain('Proxy Enabled');
    expect(staffMarkup).toContain('Link Visibility');
  });

  it('hides primary-link unavailable annotations from students in combined and split views', () => {
    const records = [{
      id: 'future-primary-resource',
      isElectronic: true,
      copiedItem: { title: 'Future primary resource' },
      resource: {
        item_url: 'https://example.test/future-primary',
        use_primary_link_visibility: '1',
        primary_link_start_visibility: futureDate,
      },
    }];

    expect(renderCombinedView(records)).not.toContain('Resource not currently available');
    expect(renderSplitView(records)).not.toContain('Resource not currently available');
  });

  it('retains staff link visibility annotations in split view', () => {
    const records = [{
      id: 'split-staff-link-resource',
      isElectronic: true,
      copiedItem: { title: 'Split staff link resource' },
      resource: {
        links: [{
          link_id: 'split-staff-link',
          title: 'Split staff-only link',
          url: 'https://example.test/split-staff-link',
          use_link_visibility: '1',
          start_visibility: futureDate,
        }],
      },
    }];

    const staffMarkup = renderSplitView(records, true);

    expect(staffMarkup).toContain('Split staff-only link');
    expect(staffMarkup).toContain('Link Visibility');
  });

  it('keeps date-only resource ends visible through the local end date in combined and split views', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));

    const records = [{
      id: 'end-date-resource',
      isElectronic: true,
      copiedItem: { title: 'Visible through today' },
      resource: { end_visibility: '2026-08-22' },
    }];

    expect(renderCombinedView(records)).toContain('Visible through today');
    expect(renderSplitView(records)).toContain('Visible through today');
  });
});

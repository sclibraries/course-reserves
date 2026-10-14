import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
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

describe('RecordTable student visibility', () => {
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

  it('removes out-of-window resources from combined view while retaining visible records', () => {
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

  it('removes hidden additional-link metadata and counts only visible links in combined view', () => {
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
    expect(studentMarkup).not.toContain('Hidden combined title');
    expect(studentMarkup).not.toContain('Hidden combined description');
    expect(studentMarkup).not.toContain('https://example.test/hidden-combined');
    expect(studentMarkup).not.toContain('Proxy Enabled');
    expect(staffMarkup).toContain('2 links available');
    expect(staffMarkup).toContain('Hidden combined title');
    expect(staffMarkup).toContain('Hidden combined description');
    expect(staffMarkup).toContain('https://example.test/hidden-combined');
    expect(staffMarkup).toContain('Proxy Enabled');
    expect(staffMarkup).toContain('Link Visibility');
  });

  it('removes hidden additional-link metadata in split view', () => {
    const records = [{
      id: 'split-link-resource',
      isElectronic: true,
      copiedItem: { title: 'Split link resource' },
      resource: {
        links: [
          {
            link_id: 'split-hidden-link',
            title: 'Hidden split title',
            description: 'Hidden split description',
            url: 'https://example.test/hidden-split',
            use_proxy: '1',
            use_link_visibility: '1',
            start_visibility: futureDate,
          },
          {
            link_id: 'split-visible-link',
            title: 'Visible split title',
            url: 'https://example.test/visible-split',
          },
        ],
      },
    }];

    const studentMarkup = renderSplitView(records);
    const staffMarkup = renderSplitView(records, true);

    expect(studentMarkup).not.toContain('Hidden split title');
    expect(studentMarkup).not.toContain('Hidden split description');
    expect(studentMarkup).not.toContain('https://example.test/hidden-split');
    expect(studentMarkup).not.toContain('Proxy Enabled');
    expect(studentMarkup).not.toContain('Not Currently Available');
    expect(studentMarkup).not.toContain('Link not currently available');
    expect(studentMarkup).toContain('https://example.test/visible-split');
    expect(staffMarkup).toContain('Hidden split title');
    expect(staffMarkup).toContain('https://example.test/hidden-split');
    expect(staffMarkup).toContain('https://example.test/visible-split');
    expect(staffMarkup).toContain('Link Visibility');
  });

  it('does not show primary-link unavailable annotations in student combined or split view', () => {
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

  it('shows date-only visibility boundaries on their local dates when staff open the popover', async () => {
    const record = {
      id: 'test-date-popover',
      isElectronic: true,
      copiedItem: { title: 'test visibility dates' },
      resource: {
        use_resource_visibility: '1',
        start_visibility: '2026-12-01',
        end_visibility: '2026-12-18',
      },
    };
    const container = document.createElement('div');
    const root = createRoot(container);
    const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.appendChild(container);

    try {
      await act(async () => {
        root.render(createElement(RecordTable, {
          combinedResults: [record],
          availability: {},
          customization: {},
          hasElectronicReserves: true,
          courseInfo: {},
          collegeParam: 'test-college',
          viewMode: 'combined',
          records: [record],
          canBypassVisibility: true,
        }));
      });

      const visibilityIcon = container.querySelector('#visibility-test-date-popover');
      expect(visibilityIcon).not.toBeNull();

      await act(async () => {
        visibilityIcon.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 1));
      });

      const popoverText = document.body.textContent;
      const expectedStartDate = new Date(2026, 11, 1).toLocaleDateString();
      const expectedEndDate = new Date(2026, 11, 18).toLocaleDateString();
      expect(popoverText).toContain(`From: ${expectedStartDate}`);
      expect(popoverText).toContain(`Until: ${expectedEndDate}`);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      if (previousActEnvironment === undefined) {
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      } else {
        globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});

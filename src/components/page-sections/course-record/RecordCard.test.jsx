import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecordCard from './RecordCard';

const futureDate = '2099-01-01T00:00:00.000Z';

const renderCard = (resource, canBypassVisibility = false, options = {}) => (
  renderToStaticMarkup(createElement(RecordCard, {
    recordItem: {
      id: 'card-resource',
      isElectronic: true,
      copiedItem: { instanceId: 'card-instance', title: 'Card resource' },
      resource,
    },
    availability: {},
    openAccordions: {},
    toggleAccordion: () => {},
    customization: {},
    courseInfo: {},
    collegeParam: 'test-college',
    canBypassVisibility,
    ...options,
  }))
);

describe('RecordCard student visibility', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes an out-of-window additional link entry for students but retains it for staff', () => {
    const resource = {
      links: [{
        link_id: 'future-card-link',
        title: 'Hidden card link title',
        description: 'Hidden card link description',
        url: 'https://example.test/hidden-card-link',
        use_proxy: '1',
        use_link_visibility: '1',
        start_visibility: futureDate,
      }],
    };

    const studentMarkup = renderCard(resource);
    const staffMarkup = renderCard(resource, true);

    expect(studentMarkup).not.toContain('Hidden card link title');
    expect(studentMarkup).not.toContain('Hidden card link description');
    expect(studentMarkup).not.toContain('https://example.test/hidden-card-link');
    expect(studentMarkup).not.toContain('Proxy Enabled');
    expect(studentMarkup).not.toContain('Not Currently Available');
    expect(studentMarkup).not.toContain('Link not currently available');

    expect(staffMarkup).toContain('Hidden card link title');
    expect(staffMarkup).toContain('Hidden card link description');
    expect(staffMarkup).toContain('https://example.test/hidden-card-link');
    expect(staffMarkup).toContain('Proxy Enabled');
    expect(staffMarkup).toContain('Link Visibility');
  });

  it('does not annotate a hidden primary link in student output', () => {
    const markup = renderCard({
      item_url: 'https://example.test/future-primary',
      use_primary_link_visibility: '1',
      primary_link_start_visibility: futureDate,
    });

    expect(markup).not.toContain('https://example.test/future-primary');
    expect(markup).not.toContain('The link to this resource is not currently available');
  });

  it('keeps a resource with a date-only end visible for the entire local end date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));

    const markup = renderCard({ end_visibility: '2026-08-22' }, false, {
      showVisibilityMessages: false,
    });

    expect(markup).toContain('Card resource');
  });
});

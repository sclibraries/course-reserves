import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVisibilitySummary } from './visibilitySummary';

const localDate = (year, month, day) => new Date(year, month - 1, day).toLocaleDateString();

describe('resource visibility summary', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    {
      name: 'a future citation window',
      formData: {
        link: 'https://example.test/primary',
        use_resource_visibility: '1',
        start_visibility: '2026-08-23',
        end_visibility: '2026-12-20',
        links: [{ url: 'https://example.test/shared', title: 'Shared link' }],
      },
      expected: {
        citation: `Available from ${localDate(2026, 8, 23)}`,
        primaryLink: 'Visible to students now',
        links: [],
      },
    },
    {
      name: 'an ended citation window',
      formData: { end_visibility: '2026-08-21', use_resource_visibility: '1' },
      expected: { citation: `Ended ${localDate(2026, 8, 21)}` },
    },
    {
      name: 'an empty primary URL',
      formData: { link: '' },
      expected: { primaryLink: 'No primary link' },
    },
    {
      name: 'video term dates',
      formData: {
        material_type_id: '3',
        start_visibility: '2026-08-23',
        end_visibility: '2026-12-20',
      },
      expected: {
        citation: `Term dates applied: ${localDate(2026, 8, 23)} to ${localDate(2026, 12, 20)}`,
      },
    },
    {
      name: 'only shared links in no-course mode',
      mode: 'none',
      sourceType: 'edit',
      formData: {
        resource_id: 'synthetic-resource-1',
        link: 'https://example.test/primary',
        start_visibility: '2026-08-23',
        use_resource_visibility: '1',
        links: [{
          url: 'https://example.test/shared',
          title: 'Shared link',
          use_link_visibility: '1',
          start_visibility: '2026-08-23',
        }],
      },
      expected: {
        citation: null,
        primaryLink: null,
        links: [{ title: 'Shared link', message: 'Not visible to students now' }],
        sharedDatesMessage: "Cross-linked pages use this resource's shared dates",
      },
    },
  ])('summarizes $name from the serialized payload', ({ formData, mode, sourceType, expected }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));

    expect(getVisibilitySummary(formData, { mode, sourceType })).toMatchObject(expected);
  });
});

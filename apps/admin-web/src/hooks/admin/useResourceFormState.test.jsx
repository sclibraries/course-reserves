import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const folioCourseData = {
    courseListingObject: {
      termObject: {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-12-20T00:00:00Z',
      },
    },
  };

  return {
    courseStoreState: { folioCourseData, termStart: null, termEnd: null },
  };
});

vi.mock('../../store/adminCourseStore', () => ({
  useAdminCourseStore: () => mocks.courseStoreState,
}));

import { renderHook } from './testUtils/renderHook';
import { useResourceFormState } from './useResourceFormState';
import { HITCHCOCK_VIDEO_PREFIX } from '../../util/externalLinks';

const termStart = '2026-09-01';
const termEnd = '2026-12-20';

let hook;

afterEach(() => {
  hook?.unmount();
  hook = null;
});

async function renderState(initialData, sourceType = 'eds') {
  hook = await renderHook((props) => useResourceFormState(props), {
    initialData,
    course: mocks.courseStoreState.folioCourseData,
    sourceType,
  });
  return hook.current;
}

describe('useResourceFormState defaults', () => {
  it('starts manual Add with term item dates and the date toggle on', async () => {
    const state = await renderState({
      start_visibility: termStart,
      end_visibility: termEnd,
    });

    expect(state.formData.start_visibility).toBe(termStart);
    expect(state.formData.end_visibility).toBe(termEnd);
    expect(state.useVisibilityDates).toBe(true);
  });

  it('keeps missing Edit item dates empty', async () => {
    const state = await renderState({ resource_id: 'synthetic-resource-17' });

    expect(state.formData.start_visibility).toBe('');
    expect(state.formData.end_visibility).toBe('');
    expect(state.useVisibilityDates).toBe(false);
  });

  it('gives a new Hitchcock video primary-link term dates', async () => {
    const state = await renderState({
      link: `${HITCHCOCK_VIDEO_PREFIX}synthetic-video`,
    });

    expect(state.formData.use_primary_link_visibility).toBe(true);
    expect(state.formData.primary_link_start_visibility).toBe(termStart);
    expect(state.formData.primary_link_end_visibility).toBe(termEnd);
  });

  it('starts a non-video EDS pick with the date toggle off', async () => {
    const state = await renderState({
      title: 'Synthetic EDS title',
      link: 'https://eds.example.test/record/17',
      material_type_id: '2',
    });

    expect(state.useVisibilityDates).toBe(false);
  });

  it.each([
    ['Manual Add', 'new', { start_visibility: termStart, end_visibility: termEnd }, termStart, termEnd, 1, false, '', ''],
    ['EDS non-video', 'eds', { material_type_id: '2' }, '', '', 0, false, '', ''],
    ['Hitchcock non-video', 'hitchcock', { material_type_id: '2' }, '', '', 0, false, '', ''],
    ['video type', 'eds', { material_type_id: '3' }, termStart, termEnd, 1, false, '', ''],
    ['Hitchcock video URL', 'hitchcock', {
      material_type_id: '3', link: `${HITCHCOCK_VIDEO_PREFIX}synthetic-video`,
    }, termStart, termEnd, 1, true, termStart, termEnd],
    ['Edit', 'edit', {
      resource_id: 'synthetic-resource-17', start_visibility: '2026-10-03', end_visibility: '',
      use_resource_visibility: 0, use_primary_link_visibility: 1,
      primary_link_start_visibility: '2026-10-04', primary_link_end_visibility: '',
    }, '2026-10-03', '', 0, true, '2026-10-04', ''],
    ['Reuse', 'reuse', {
      start_visibility: termStart, end_visibility: termEnd, use_resource_visibility: 1,
      use_primary_link_visibility: 1, primary_link_start_visibility: termStart, primary_link_end_visibility: termEnd,
    }, '', '', 0, false, '', ''],
  ])('%s visibility defaults preserve the resource-form table row', async (
    _row, sourceType, initialData, start, end, resourceFlag, primaryEnabled, primaryStart, primaryEnd,
  ) => {
    const state = await renderState(initialData, sourceType);

    expect(state.formData.start_visibility).toBe(start);
    expect(state.formData.end_visibility).toBe(end);
    expect(state.formData.use_resource_visibility).toBe(resourceFlag);
    expect(state.formData.use_primary_link_visibility).toBe(primaryEnabled);
    expect(state.formData.primary_link_start_visibility).toBe(primaryStart);
    expect(state.formData.primary_link_end_visibility).toBe(primaryEnd);
  });

  it.each(['0', 0, false, null])('normalizes %p to off for each visibility flag', async (offFlag) => {
    const state = await renderState({
      resource_id: 'synthetic-resource-17',
      start_visibility: '2026-09-01',
      use_resource_visibility: offFlag,
      use_primary_link_visibility: offFlag,
      links: [{
        url: 'https://example.test/synthetic-link',
        use_link_visibility: offFlag,
      }],
    }, 'edit');

    expect(state.useVisibilityDates).toBe(false);
    expect(state.formData.use_primary_link_visibility).toBe(false);
    expect(state.links[0].use_link_visibility).toBe(false);
  });

  it('sets the item flag when dates are entered and clears it when both dates are cleared', async () => {
    await renderState({
      start_visibility: '',
      end_visibility: '',
      use_resource_visibility: 0,
    }, 'eds');

    await act(async () => hook.current.handleItemDateChange({
      target: { name: 'start_visibility', value: '2026-09-01' },
    }));
    expect(hook.current.formData.use_resource_visibility).toBe(1);
    expect(hook.current.useVisibilityDates).toBe(true);

    await act(async () => hook.current.handleItemDateChange({
      target: { name: 'start_visibility', value: '' },
    }));
    expect(hook.current.formData.use_resource_visibility).toBe(0);
    expect(hook.current.useVisibilityDates).toBe(false);
  });
});

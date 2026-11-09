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

async function renderState(initialData) {
  hook = await renderHook((props) => useResourceFormState(props), {
    initialData,
    course: mocks.courseStoreState.folioCourseData,
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

  it('fills missing edit item dates from the term while leaving the toggle off', async () => {
    const state = await renderState({ resource_id: 'synthetic-resource-17' });

    expect(state.formData.start_visibility).toBe(termStart);
    expect(state.formData.end_visibility).toBe(termEnd);
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
});

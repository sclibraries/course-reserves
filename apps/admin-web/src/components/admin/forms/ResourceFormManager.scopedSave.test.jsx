import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, waitFor } from '@testing-library/dom';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toastError: vi.fn(),
  formData: {
    resource_id: 'resource-17',
    title: 'Synthetic resource',
    link: 'https://example.test/resource',
    use_proxy: false,
    loaded: true,
    links: [],
    metadata: {},
    start_visibility: '',
    end_visibility: '2026-12-20',
    use_resource_visibility: 0,
    use_primary_link_visibility: 1,
    primary_link_start_visibility: '2026-09-01',
    primary_link_end_visibility: '',
  },
  courseStoreState: {
    folioCourseData: {
      offering_id: 'folio-offering-17',
      course_id: 'folio-course-17',
      courseListingObject: { termObject: { startDate: '2026-09-01', endDate: '2026-12-20' } },
    },
    termStart: null,
    termEnd: null,
  },
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('./resource-form/ResourceForm', () => {
  function MockResourceForm({ onSubmit }) {
    return (
      <button type="button" onClick={async () => {
        try {
          await onSubmit(mocks.formData);
        } catch {
          // The real form keeps its inline error after a rejected save.
        }
      }}>Submit scoped resource</button>
    );
  }
  MockResourceForm.propTypes = { onSubmit: PropTypes.func.isRequired };
  return { default: MockResourceForm };
});
vi.mock('../../../store/adminCourseStore', () => ({
  useAdminCourseStore: () => mocks.courseStoreState,
}));

import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

const course = { offering_id: 'offering-17', course_id: 'course-17' };
const visibilityFields = [
  'start_visibility', 'end_visibility', 'use_resource_visibility',
  'primary_link_start_visibility', 'primary_link_end_visibility', 'use_primary_link_visibility',
];

let container;
let root;

async function renderEdit(mode, initialData = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <ResourceFormManager
      isOpen
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      formType={ResourceFormType.EDIT}
      initialData={{ resource_id: 'resource-17', ...initialData }}
      course={course}
      mode={mode}
    />,
  ));
}

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = 'accessToken=synthetic-aw088c1a-token; path=/';
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ resource_id: 'resource-17' }),
  });
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  document.cookie = 'accessToken=; Max-Age=0; path=/';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ResourceFormManager scoped edits', () => {
  it.each([
    { mode: 'course', expectedOffering: 'offering-17', expectedCourseResource: 'course-resource-29' },
    { mode: 'none', expectedOffering: undefined, expectedCourseResource: undefined },
  ])('$mode mode scopes the update body and clears dates to null', async ({
    mode, expectedOffering, expectedCourseResource,
  }) => {
    await renderEdit(mode, { course_resource_id: 'course-resource-29' });

    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Submit scoped resource' })));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));

    const [, request] = mocks.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    if (mode === 'course') {
      expect(body).toMatchObject({
        offering_id: expectedOffering,
        course_resource_id: expectedCourseResource,
        start_visibility: null,
        end_visibility: '2026-12-20',
        primary_link_start_visibility: '2026-09-01',
        primary_link_end_visibility: null,
      });
    } else {
      expect(body).not.toHaveProperty('offering_id');
      expect(body).not.toHaveProperty('course_resource_id');
      visibilityFields.forEach((field) => expect(body).not.toHaveProperty(field));
    }
    expect(body).not.toHaveProperty('resource_id');
  });

  it.each([
    {
      name: 'a 422 envelope',
      body: {
        message: 'This page is out of date. Reload and save again.',
        reference: 'SYNTH-AW088C1A-422',
      },
      toast: 'This page is out of date. Reload and save again. Reference: SYNTH-AW088C1A-422',
    },
    {
      name: 'a response without the envelope',
      body: { error: 'Synthetic failure' },
      toast: "Couldn't save the resource",
    },
    {
      name: 'a non-JSON response',
      invalidJson: true,
      toast: "Couldn't save the resource",
    },
  ])('shows the expected error toast for $name', async ({ body, invalidJson, toast }) => {
    const json = invalidJson
      ? vi.fn().mockRejectedValue(new SyntaxError('Synthetic invalid JSON'))
      : vi.fn().mockResolvedValue(body);
    const response = { ok: false, json };
    mocks.fetch.mockResolvedValue(response);
    await renderEdit('course', { course_resource_id: 'course-resource-29' });

    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Submit scoped resource' })));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));

    expect(mocks.toastError.mock.calls[0][0]).toBe(toast);
  });
});

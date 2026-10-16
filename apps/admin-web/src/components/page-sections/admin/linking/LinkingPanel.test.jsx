import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getCandidates: vi.fn(),
  getTimeline: vi.fn(),
  linkSubmission: vi.fn(),
  correctSubmission: vi.fn(),
  overrideSubmissionLink: vi.fn(),
  unlinkSubmission: vi.fn(),
  recheckSubmission: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../../../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: {
    getCandidates: mocks.getCandidates,
    getTimeline: mocks.getTimeline,
    linkSubmission: mocks.linkSubmission,
    correctSubmission: mocks.correctSubmission,
    overrideSubmissionLink: mocks.overrideSubmissionLink,
    unlinkSubmission: mocks.unlinkSubmission,
    recheckSubmission: mocks.recheckSubmission,
  },
}));

import LinkingPanel from './LinkingPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const submission = {
  uuid: 'synthetic-uuid',
  courseCode: 'afr 155',
  courseTitle: 'African Studies',
  section: '01',
  term: '2026FA',
  rosterTermId: 'term-1',
  linkState: 'needs_linking',
  linkFlag: null,
  folioCourseListingId: null,
};

const exactCandidate = {
  folio_course_listing_id: 'folio-listing-1',
  courses: [{ courseNumber: 'AFR155', sectionName: '1', name: 'African Studies' }],
  term: { id: 'term-1', name: 'Fall 2026' },
  match: 'exact',
  fields: { course_number: true, section: true, term: true },
};

const renderPanel = async (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<LinkingPanel submission={submission} onChanged={vi.fn()} {...props} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const click = async (element) => act(async () => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

const input = async (element, value) => act(async () => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
});

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.getCandidates.mockReset().mockResolvedValue({ items: [exactCandidate], checked_at: '2026-10-16T12:00:00Z' });
  mocks.getTimeline.mockReset().mockResolvedValue({ items: [{
    event_type: 'linked', actor: 'staff@example.edu', actor_role: 'staff',
    reason: 'Exact match confirmed', before: null, after: { link_state: 'linked' },
    created_at: '2026-10-16T12:00:00Z',
  }] });
  mocks.linkSubmission.mockReset().mockResolvedValue({ link_state: 'linked' });
  mocks.correctSubmission.mockReset().mockResolvedValue({ link_state: 'needs_linking' });
  mocks.overrideSubmissionLink.mockReset().mockResolvedValue({ link_flag: 'mismatch_override' });
  mocks.unlinkSubmission.mockReset().mockResolvedValue({ link_state: 'needs_linking' });
  mocks.recheckSubmission.mockReset().mockResolvedValue({ checked_at: '2026-10-16T12:00:00Z' });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LinkingPanel', () => {
  it('shows normalized roster and FOLIO matches with a check for each field', async () => {
    const view = await renderPanel();

    expect(view.container.textContent).toContain('Course number ✓');
    expect(view.container.textContent).toContain('Section ✓');
    expect(view.container.textContent).toContain('Term ✓');
    view.unmount();
  });

  it('shows field mismatches and an unverified term when roster mapping is missing', async () => {
    mocks.getCandidates.mockResolvedValueOnce({ items: [{
      ...exactCandidate,
      courses: [{ courseNumber: 'BIO 101', sectionName: '02', name: 'Biology' }],
      term: { id: 'term-2', name: 'Spring 2027' },
      match: 'possible',
      fields: { course_number: false, section: false, term: false },
    }] });
    const view = await renderPanel({ submission: { ...submission, rosterTermId: null } });

    expect(view.container.textContent).toContain('Course number ×');
    expect(view.container.textContent).toContain('Section ×');
    expect(view.container.textContent).toContain('Term unverified');
    expect(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Link')).disabled).toBe(true);
    view.unmount();
  });

  it('only enables Link for an exact candidate', async () => {
    mocks.getCandidates.mockResolvedValueOnce({ items: [{ ...exactCandidate, match: 'possible' }] });
    const view = await renderPanel();
    const linkButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Link');

    expect(linkButton.disabled).toBe(true);
    view.unmount();
  });

  it('links the selected exact candidate and opens its existing admin course page', async () => {
    const view = await renderPanel();
    const linkButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Link');
    await click(linkButton);

    expect(mocks.linkSubmission).toHaveBeenCalledWith('synthetic-uuid', { folio_course_listing_id: 'folio-listing-1' });
    view.unmount();

    const linkedView = await renderPanel({ submission: { ...submission, linkState: 'linked', folioCourseListingId: 'folio-listing-1' } });
    const openButton = Array.from(linkedView.container.querySelectorAll('button')).find((button) => button.textContent.includes('Open course page'));
    await click(openButton);
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/electronic/folio-listing-1');
    linkedView.unmount();
  });

  it('keeps term immutable in correction and requires a reason', async () => {
    const view = await renderPanel();
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Correct submission')));
    const form = view.container.querySelector('[data-testid="correct-submission-form"]');

    expect(form.querySelector('input[name="term"]')).toBeNull();
    expect(form.querySelector('input[name="course_code"]').value).toBe('afr 155');
    expect(form.querySelector('input[name="reason"]').required).toBe(true);
    expect(Array.from(form.querySelectorAll('button')).find((button) => button.textContent.includes('Save correction')).disabled).toBe(true);
    view.unmount();
  });

  it('shows the already-linked staff member and tells staff to unlink before correcting', async () => {
    mocks.correctSubmission.mockRejectedValueOnce(Object.assign(new Error('Conflict'), {
      status: 409,
      payload: { error_code: 'already_linked', linked_by: 'sam-staff' },
    }));
    const view = await renderPanel();
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Correct submission')));
    const form = view.container.querySelector('[data-testid="correct-submission-form"]');
    await input(form.querySelector('input[name="reason"]'), 'Fixing typo');
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(mocks.correctSubmission).toHaveBeenCalledWith('synthetic-uuid', {
      course_code: 'afr 155', section: '01', reason: 'Fixing typo',
    });
    expect(view.container.textContent).toContain('sam-staff');
    expect(view.container.textContent).toContain('Unlink first');
    view.unmount();
  });

  it('reports non-exact link conflicts, network errors, and timeline events', async () => {
    mocks.linkSubmission.mockRejectedValueOnce(Object.assign(new Error('Conflict'), {
      status: 409,
      payload: { error_code: 'not_exact_match', fields: { course_number: true, section: false, term: false } },
    }));
    const view = await renderPanel();
    const linkButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Link');
    await click(linkButton);

    expect(view.container.querySelector('[role="alert"]').textContent).toContain('Section, Term did not match');
    expect(view.container.textContent).toContain('Exact match confirmed');
    expect(view.container.textContent).toContain('staff@example.edu');
    view.unmount();

    mocks.getCandidates.mockRejectedValueOnce(new Error('Network offline'));
    const networkView = await renderPanel();
    expect(networkView.container.textContent).toContain('Network offline');
    networkView.unmount();
  });

  it('searches candidate listings with the roster course and pre-fills its term', async () => {
    const view = await renderPanel();
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Search FOLIO')));

    expect(view.container.querySelector('#folio-course-query').value).toBe('afr 155');
    expect(view.container.querySelector('#folio-course-term').value).toBe('2026FA');
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent === 'Search'));

    expect(mocks.getCandidates).toHaveBeenLastCalledWith('synthetic-uuid', 'afr 155');
    view.unmount();
  });

  it('re-checks suggestions using the submission endpoint', async () => {
    const view = await renderPanel();
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Re-check')));

    expect(mocks.recheckSubmission).toHaveBeenCalledWith('synthetic-uuid');
    view.unmount();
  });

  it('requires a reason before linking anyway and sends the selected candidate', async () => {
    mocks.getCandidates.mockResolvedValueOnce({ items: [{ ...exactCandidate, match: 'possible' }], checked_at: null });
    const view = await renderPanel();
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Link anyway')));
    const form = view.container.querySelector('form');
    const reason = form.querySelector('input[required]');
    const submit = form.querySelector('button[type="submit"]');

    expect(reason).toBeTruthy();
    expect(submit.disabled).toBe(true);
    await input(reason, 'Owner approved this mismatch');
    expect(submit.disabled).toBe(false);
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(mocks.overrideSubmissionLink).toHaveBeenCalledWith('synthetic-uuid', {
      folio_course_listing_id: 'folio-listing-1', reason: 'Owner approved this mismatch',
    });
    view.unmount();
  });

  it('requires an unlink reason and disables unlink with an explanation after publishing', async () => {
    const linkedSubmission = { ...submission, linkState: 'linked', folioCourseListingId: 'folio-listing-1' };
    const view = await renderPanel({
      submission: linkedSubmission,
      items: [{ status: 'available_online', materializedAt: '2026-10-16T12:00:00Z' }],
    });
    const unlinkButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Unlink');

    expect(unlinkButton.disabled).toBe(true);
    expect(view.container.textContent).toContain('Unlink is unavailable after items are published.');
    expect(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Open course page'))).toBeTruthy();
    view.unmount();
  });
});

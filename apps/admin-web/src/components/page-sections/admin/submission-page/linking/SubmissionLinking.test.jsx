import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import axe from 'axe-core';
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

vi.mock('../../../../../services/admin/submissionWorkflowService', () => ({
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
vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal(),
  useNavigate: () => mocks.navigate,
}));

import useSubmissionLinking from '../../../../../hooks/admin/useSubmissionLinking';
import SubmissionPageHeader from '../SubmissionPageHeader';
import LinkingStep from './LinkingStep';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const submission = {
  uuid: 'synthetic-uuid',
  courseCode: 'afr 155',
  courseTitle: 'African Studies',
  section: '01',
  term: '2026FA',
  termCode: '2026FA',
  rosterTermId: 'term-1',
  linkState: 'needs_linking',
  linkFlag: null,
  folioCourseListingId: null,
};

const exactCandidate = {
  folio_course_listing_id: 'folio-listing-1',
  courses: [{ courseNumber: 'AFR155', sectionName: '01', name: 'African Studies' }],
  term: { id: 'term-1', name: 'Fall 2026' },
  match: 'exact',
  fields: { course_number: true, section: true, term: true },
};

const mismatchCandidate = {
  folio_course_listing_id: 'folio-listing-2',
  courses: [{ courseNumber: 'BIO 101', sectionName: '02', name: 'Biology' }],
  term: { id: 'term-2', name: 'Spring 2027' },
  match: 'possible',
  fields: { course_number: false, section: false, term: false },
};

const timeline = [{
  event_type: 'linked',
  actor: 'Synthetic staff member',
  actor_role: 'staff',
  reason: 'Exact match confirmed',
  before: null,
  after: { link_state: 'linked' },
  created_at: '2026-10-16T12:00:00Z',
}];

function Harness({ record = submission, items = [] }) {
  const linking = useSubmissionLinking(record, items, vi.fn());
  const isLinked = record.linkState === 'linked';
  return (
    <main>
      <SubmissionPageHeader
        submission={record}
        counts={{ total: 1, todo: 1, inProgress: 0, done: 0 }}
        isLinked={isLinked}
        onBack={vi.fn()}
        onLock={vi.fn()}
        onUnlock={vi.fn()}
        linking={linking}
      />
      {!isLinked && (
        <section aria-label="Work pane">
          <LinkingStep submission={record} linking={linking} />
        </section>
      )}
    </main>
  );
}

Harness.propTypes = {
  record: PropTypes.object,
  items: PropTypes.arrayOf(PropTypes.object),
};

async function renderLinking(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><Harness {...props} /></MemoryRouter>));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function expectAccessible() {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations).toEqual([]);
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.getCandidates.mockReset().mockResolvedValue({
    items: [exactCandidate, mismatchCandidate],
    checked_at: '2026-10-16T12:00:00Z',
  });
  mocks.getTimeline.mockReset().mockResolvedValue({ items: timeline });
  mocks.linkSubmission.mockReset().mockResolvedValue({ link_state: 'linked' });
  mocks.correctSubmission.mockReset().mockResolvedValue({ link_state: 'needs_linking' });
  mocks.overrideSubmissionLink.mockReset().mockResolvedValue({ link_flag: 'mismatch_override' });
  mocks.unlinkSubmission.mockReset().mockResolvedValue({ link_state: 'needs_linking' });
  mocks.recheckSubmission.mockReset().mockResolvedValue({ checked_at: '2026-10-16T12:00:00Z' });
});

afterEach(() => { document.body.innerHTML = ''; });

describe('submission linking step', () => {
  it('updates the comparison when a candidate card is selected', async () => {
    const view = await renderLinking();

    expect(screen.getByText('Step 1 · Link the course')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Choose the FOLIO course for this submission' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: /AFR155/ })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /BIO 101/ })));
    expect(screen.getByRole('cell', { name: /BIO 101/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /BIO 101/ }).getAttribute('aria-pressed')).toBe('true');
    await expectAccessible();
    view.unmount();
  });

  it('links an exact candidate directly', async () => {
    const view = await renderLinking();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Link course' })));
    expect(mocks.linkSubmission).toHaveBeenCalledWith('synthetic-uuid', {
      folio_course_listing_id: 'folio-listing-1',
    });
    view.unmount();
  });

  it('requires a reason before linking a mismatch', async () => {
    const view = await renderLinking();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /BIO 101/ })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Link with mismatch' })));

    const reason = screen.getByRole('textbox', { name: 'Reason for linking with a mismatch (required)' });
    expect(screen.getByRole('dialog', { name: 'Link with mismatch' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm link' }).disabled).toBe(true);
    await act(async () => fireEvent.change(reason, { target: { value: 'Approved mismatch' } }));
    await expectAccessible();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm link' })));

    expect(mocks.overrideSubmissionLink).toHaveBeenCalledWith('synthetic-uuid', {
      folio_course_listing_id: 'folio-listing-2', reason: 'Approved mismatch',
    });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Link with mismatch' })));
    view.unmount();
  });

  it('requires a reason before correcting the submission', async () => {
    const view = await renderLinking();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Correct submission' })));

    expect(screen.getByRole('dialog', { name: 'Correct submission' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Reason (required)' }).required).toBe(true);
    expect(screen.getByRole('button', { name: 'Save correction' }).disabled).toBe(true);
    await act(async () => fireEvent.change(screen.getByRole('textbox', { name: 'Reason (required)' }), { target: { value: 'Roster typo' } }));
    await expectAccessible();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save correction' })));
    expect(mocks.correctSubmission).toHaveBeenCalledWith('synthetic-uuid', {
      course_code: 'afr 155', section: '01', reason: 'Roster typo',
    });
    view.unmount();
  });

  it('opens Change and requires a reason before unlinking', async () => {
    const view = await renderLinking({
      record: { ...submission, linkState: 'linked', folioCourseListingId: 'folio-listing-1' },
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Change' })));

    expect(screen.getByRole('dialog', { name: 'Change linked course' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: /AFR155/ })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Unlink' })));
    const reason = screen.getByRole('textbox', { name: 'Reason for unlinking (required)' });
    expect(reason.required).toBe(true);
    expect(screen.getByRole('button', { name: 'Confirm unlink' }).disabled).toBe(true);
    await act(async () => fireEvent.change(reason, { target: { value: 'Wrong section' } }));
    await expectAccessible();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm unlink' })));
    expect(mocks.unlinkSubmission).toHaveBeenCalledWith('synthetic-uuid', { reason: 'Wrong section' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' })));
    view.unmount();
  });

  it('searches FOLIO candidates and re-checks through the existing workflow calls', async () => {
    const view = await renderLinking();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Search FOLIO' })));
    const query = screen.getByRole('textbox', { name: 'Search FOLIO by course number or title' });
    expect(query.value).toBe('afr 155');
    await act(async () => fireEvent.change(query, { target: { value: 'BIO 101' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Search' })));
    expect(mocks.getCandidates).toHaveBeenLastCalledWith('synthetic-uuid', 'BIO 101');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Re-check' })));
    expect(mocks.recheckSubmission).toHaveBeenCalledWith('synthetic-uuid');
    view.unmount();
  });

  it('keeps unlink unavailable after items have been published', async () => {
    const view = await renderLinking({
      record: { ...submission, linkState: 'linked', folioCourseListingId: 'folio-listing-1' },
      items: [{ status: 'available_online', materializedAt: '2026-10-16T12:00:00Z' }],
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Change' })));
    const dialog = screen.getByRole('dialog', { name: 'Change linked course' });
    expect(dialog.textContent).toContain('Unlink is unavailable after items have been published.');
    expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
    view.unmount();
  });

  it('opens Activity in a sheet and keeps JSON details collapsed', async () => {
    const view = await renderLinking();

    expect(mocks.getTimeline).not.toHaveBeenCalled();
    expect(screen.queryByText('Exact match confirmed')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Activity' })));
    expect(await screen.findByRole('dialog', { name: 'Submission activity' })).toBeTruthy();
    expect(screen.getByText('Exact match confirmed')).toBeTruthy();
    expect(screen.getByText('Change details').closest('details').open).toBe(false);
    expect(mocks.getTimeline).toHaveBeenCalledWith('synthetic-uuid');
    await expectAccessible();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Close' })));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Activity' })));
    view.unmount();
  });

  it('shows a generic FOLIO error with its reference', async () => {
    mocks.getCandidates.mockRejectedValueOnce(Object.assign(new Error('Raw provider detail'), {
      payload: { error_code: 'folio_unavailable', message: 'Raw provider detail', reference: 'ABC123' },
    }));
    const view = await renderLinking();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('FOLIO is temporarily unavailable');
    expect(screen.getByRole('alert').textContent).toContain('ABC123');
    expect(screen.getByRole('alert').textContent).not.toContain('Raw provider detail');
    view.unmount();
  });
});

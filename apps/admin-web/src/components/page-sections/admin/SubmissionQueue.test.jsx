import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getAllByRole, getByRole, queryByRole } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ storeState: {} }));

vi.mock('../../../store/submissionWorkflowStore', () => ({ default: () => mocks.storeState }));

import SubmissionQueue from './SubmissionQueue';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const submissions = [
  {
    submissionId: 99907802, status: 'in_progress', courseCode: 'TST 101', courseTitle: 'Synthetic Testing',
    section: '02', facultyName: 'Synthetic Faculty', term: '2026FA', submittedAt: '2026-10-15T12:00:00Z',
    totalItems: 2, completionPercentage: 50, completeItems: 1, priority: 'urgent', isLocked: true,
    lockedBy: 'Synthetic Staff', communicationsCount: 2, unreadCommunications: 1, assignedTo: 'Synthetic Staff',
  },
  {
    submissionId: 99907801, status: 'draft', courseCode: 'BIO 110', courseTitle: 'Synthetic Biology',
    section: '01', facultyName: 'Another Synthetic Faculty', term: '2026FA', submittedAt: null,
    totalItems: 2, completionPercentage: 0, completeItems: 0, priority: 'normal', isLocked: false,
    lockedBy: null, communicationsCount: 0, unreadCommunications: 0, assignedTo: null,
  },
];

let root;
let container;

async function renderQueue(overrides = {}) {
  const defaults = {
    submissions,
    loading: false,
    error: null,
    pagination: { currentPage: 1, pageCount: 1, perPage: 20, totalCount: submissions.length },
    fetchPendingSubmissions: vi.fn(),
    setPage: vi.fn(),
    clearError: vi.fn(),
  };
  mocks.storeState = {
    ...defaults,
    ...overrides,
    pagination: { ...defaults.pagination, ...overrides.pagination },
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <MemoryRouter initialEntries={['/admin?tab=submissions']}>
      <SubmissionQueue />
    </MemoryRouter>,
  ));
}

beforeEach(() => {
  mocks.storeState = {};
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('SubmissionQueue', () => {
  it('shows five columns and submitted and draft details in API order', async () => {
    await renderQueue();

    const table = getByRole(container, 'table', { name: 'Faculty submissions' });
    expect(getAllByRole(table, 'columnheader').map((header) => header.textContent)).toEqual([
      'Course', 'Faculty', 'Submitted', 'Progress', 'Status',
    ]);
    const rows = getAllByRole(table, 'row').slice(1);
    expect(rows).toHaveLength(2);
    expect(getAllByRole(rows[0], 'cell')).toHaveLength(5);
    expect(getAllByRole(rows[1], 'cell')).toHaveLength(5);
    expect(getAllByRole(table, 'link').map((link) => link.textContent)).toEqual(['TST 101 - 02', 'BIO 110 - 01']);

    const courseLink = getByRole(rows[0], 'link', { name: 'TST 101 - 02' });
    expect(courseLink.getAttribute('href')).toBe('/admin/submissions/99907802');
    expect(rows[0].textContent).toContain('Synthetic Testing');
    expect(rows[0].textContent).toContain('2026FA');
    expect(rows[0].textContent).toContain('Synthetic Faculty');
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-15T12:00:00Z');
    expect(getByRole(rows[0], 'progressbar', { name: '1 of 2 items done' })).toBeTruthy();
    expect(rows[0].textContent).toContain('1 of 2 done');
    expect(rows[0].textContent).toContain('In Progress');
    expect(rows[0].textContent).toContain('Urgent');
    expect(rows[0].textContent).toContain('Assigned to Synthetic Staff');
    expect(rows[0].textContent).toContain('Locked by Synthetic Staff');
    expect(rows[0].textContent).toContain('2 messages, 1 unread');
    expect(rows[1].textContent).toContain('Not submitted');
    expect(rows[1].textContent).toContain('Draft');
    expect(rows[1].textContent).toContain('Unassigned');
  });

  it('keeps drafts visible by default and filters them without changing total count', async () => {
    await renderQueue({ pagination: { totalCount: 15 } });

    const table = getByRole(container, 'table', { name: 'Faculty submissions' });
    const showDrafts = getByRole(container, 'checkbox', { name: 'Show drafts' });
    expect(showDrafts.checked).toBe(true);
    expect(getByRole(table, 'link', { name: 'BIO 110 - 01' })).toBeTruthy();
    expect(container.textContent).toContain('15 total submissions');
    expect(mocks.storeState.fetchPendingSubmissions).toHaveBeenCalledWith(1, 20);

    await act(async () => fireEvent.click(showDrafts));

    expect(queryByRole(table, 'link', { name: 'BIO 110 - 01' })).toBeNull();
    expect(getByRole(table, 'link', { name: 'TST 101 - 02' })).toBeTruthy();
    expect(container.textContent).toContain('15 total submissions');
  });

  it('announces the loading state', async () => {
    await renderQueue({ submissions: [], loading: true, pagination: { totalCount: 0 } });

    expect(getByRole(container, 'status').textContent).toContain('Loading submissions');
  });

  it('shows an announced empty state when no submissions match', async () => {
    await renderQueue({ submissions: [], pagination: { totalCount: 0 } });

    expect(getByRole(container, 'status').textContent).toContain('There are currently no pending faculty submissions');
  });

  it('uses a generic load error and lets staff dismiss it', async () => {
    await renderQueue({ error: 'Sensitive server detail' });

    expect(getByRole(container, 'alert').textContent).toContain('Could not load submissions. Please try again.');
    expect(container.textContent).not.toContain('Sensitive server detail');
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Dismiss error' })));
    expect(mocks.storeState.clearError).toHaveBeenCalledOnce();
  });

  it('changes pages using the store paging action', async () => {
    await renderQueue({ pagination: { currentPage: 2, pageCount: 5 } });

    expect(getByRole(container, 'navigation', { name: 'Submission pages' })).toBeTruthy();
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Page 3' })));

    expect(mocks.storeState.setPage).toHaveBeenCalledWith(3);
  });

  it('has no axe violations', async () => {
    await renderQueue();

    expect(await axe(container)).toHaveNoViolations();
  });
});

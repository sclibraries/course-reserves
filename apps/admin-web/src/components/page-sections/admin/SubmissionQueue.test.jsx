import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), storeState: {} }));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../../store/submissionWorkflowStore', () => ({ default: () => mocks.storeState }));

import SubmissionQueue from './SubmissionQueue';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const submissions = [
  {
    submissionId: 99907801, status: 'draft', courseCode: 'BIO 110', courseTitle: 'Synthetic Biology',
    section: '01', facultyName: 'Test Faculty', term: '2026FA', submittedAt: null, totalItems: 2,
    completionPercentage: 0, completeItems: 0, priority: 'normal', isLocked: false,
    communicationsCount: 0, unreadCommunications: 0,
  },
  {
    submissionId: 99907802, status: 'submitted', courseCode: 'TST 101', courseTitle: 'Synthetic Testing',
    section: '02', facultyName: 'Test Faculty', term: '2026FA', submittedAt: '2026-10-15T12:00:00Z', totalItems: 1,
    completionPercentage: 0, completeItems: 0, priority: 'normal', isLocked: false,
    communicationsCount: 0, unreadCommunications: 0,
  },
];

let root;
let container;

async function renderQueue() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<SubmissionQueue />));
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.storeState = {
    submissions,
    loading: false,
    error: null,
    pagination: { currentPage: 1, pageCount: 1, totalCount: submissions.length },
    fetchPendingSubmissions: vi.fn(),
    setPage: vi.fn(),
    clearError: vi.fn(),
  };
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('SubmissionQueue drafts', () => {
  it('shows drafts by default, labels them, and lets staff hide them while submitted rows remain unchanged', async () => {
    await renderQueue();

    const showDrafts = container.querySelector('input[name="show-drafts"]');
    expect(showDrafts.checked).toBe(true);
    expect(container.textContent).toContain('Draft');
    expect(container.textContent).toContain('BIO 110');
    expect(container.textContent).toContain('Submitted');
    expect(container.textContent).toContain('TST 101');
    expect(Array.from(container.querySelectorAll('tbody tr')).find((row) => row.textContent.includes('TST 101'))
      .querySelector('button').textContent).toContain('View');

    await act(async () => showDrafts.click());

    expect(container.textContent).not.toContain('BIO 110');
    expect(container.textContent).toContain('TST 101');
    expect(container.textContent).toContain('Submitted');
  });
});

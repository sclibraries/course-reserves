import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), getCurrentUser: vi.fn(), storeState: {} }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ submissionId: '99907801' }),
}));
vi.mock('../../../store/submissionWorkflowStore', () => ({ default: () => mocks.storeState }));
vi.mock('../../../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: { getCurrentUser: mocks.getCurrentUser },
}));

import SubmissionDetail from './SubmissionDetail';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const firstItem = { id: 99907811, title: 'Faculty first item', materialType: 'Book', displayOrder: 1 };
const secondItem = { id: 99907812, title: 'Faculty second item', materialType: 'Article', displayOrder: 2 };

let root;
let container;

async function renderDetail() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<SubmissionDetail />));
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.getCurrentUser.mockReset().mockResolvedValue({ id: 99907800, username: 'testadmin' });
  mocks.storeState = {
    selectedSubmission: {
      submission: {
        id: 99907801, uuid: 'synthetic-api078-draft', courseCode: 'TST 101', courseTitle: 'Synthetic testing',
        section: '01', facultyName: 'Test Faculty', term: '2026FA', status: 'draft', submittedAt: null,
        isLocked: false, folioCourseListingId: null,
      },
      folders: [{ name: 'Readings', items: [secondItem] }],
      unfolderedItems: [firstItem],
      statistics: { totalItems: 2, byStatus: { pending: 2, inProgress: 0, complete: 0 }, completionPercentage: 0 },
    },
    loading: false,
    error: null,
    fetchSubmissionDetail: vi.fn(),
    lockSubmission: vi.fn(),
    unlockSubmission: vi.fn(),
    clearError: vi.fn(),
    updateItemStatus: vi.fn(),
  };
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('SubmissionDetail drafts', () => {
  it('shows a read-only draft banner and items in faculty order without processing controls', async () => {
    await renderDetail();

    expect(container.textContent).toContain('Draft - not submitted yet. You can view it; it can\'t be processed until the faculty member submits.');
    expect(container.textContent).toContain('Draft');
    expect(Array.from(container.querySelectorAll('[data-draft-item-id]')).map((row) => row.textContent))
      .toEqual(['Faculty first item · Book', 'Faculty second item · Article']);
    expect(container.textContent).not.toContain('Lock & Process');
    expect(container.textContent).not.toContain('Claim all');
    expect(container.textContent).not.toContain('Work on This');
    expect(container.querySelector('button[data-action]')).toBeNull();
  });

  it('keeps the current submission rendered during a detail refresh', async () => {
    mocks.storeState.loading = true;
    await renderDetail();

    expect(container.textContent).toContain('Draft - not submitted yet.');
    expect(container.textContent).not.toContain('Loading submission details...');
  });
});

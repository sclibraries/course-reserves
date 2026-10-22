import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmissionDetail from './SubmissionDetail';
import MyWorkQueue from './MyWorkQueue';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getCurrentUser: vi.fn(),
  getCandidates: vi.fn(),
  consoleLog: vi.fn(),
  setSearchParams: vi.fn(),
  searchParams: null,
  storeState: {},
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal(),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ submissionId: '31' }),
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
}));

vi.mock('../../../store/submissionWorkflowStore', () => ({
  default: () => mocks.storeState,
}));

vi.mock('../../../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: {
    getCurrentUser: mocks.getCurrentUser,
    getCandidates: mocks.getCandidates,
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const processingContext = {
  submissionId: 31,
  submissionUuid: 'submission-uuid',
  itemId: 88,
  folioCourseListingId: 'folio-course-123',
  offeringId: 44,
  canOpenProcessing: true,
  blockingReason: null,
};

const submissionItem = {
  id: '88',
  title: 'Handbook of Course Reserves',
  authors: 'A. Librarian',
  materialType: 'Book',
  displayOrder: 1,
  status: 'in_progress',
  priority: 'normal',
  claimedBy: { id: 42, username: 'staff' },
  processingContext,
};

const renderComponent = async (ui) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<MemoryRouter>{ui}</MemoryRouter>);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const findButton = (container, label) =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent.includes(label)
  );

const click = async (element) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('workflow processing handoff regression', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.consoleLog.mockReset();
    mocks.setSearchParams.mockReset();
    mocks.searchParams = new URLSearchParams();
    vi.spyOn(console, 'log').mockImplementation(mocks.consoleLog);
    mocks.getCurrentUser.mockResolvedValue({ id: 42, username: 'staff' });
    mocks.getCandidates.mockResolvedValue({ items: [], checked_at: null });
    mocks.storeState = {
      selectedSubmission: {
        submission: {
          uuid: 'submission-uuid',
          courseCode: 'ENG 101',
          courseTitle: 'Introduction to Literature',
          facultyName: 'Dr. Faculty',
          term: 'Fall 2026',
          submittedAt: '2026-06-16T12:00:00Z',
          status: 'processing',
          isLocked: false,
          linkState: 'linked',
          folioCourseListingId: 'folio-course-123',
        },
        folders: [],
        unfolderedItems: [submissionItem],
        statistics: {
          totalItems: 1,
          byStatus: {
            pending: 0,
            inProgress: 1,
            complete: 0,
          },
          completionPercentage: 0,
        },
      },
      claimedItems: [],
      loading: false,
      error: null,
      fetchSubmissionDetail: vi.fn(),
      lockSubmission: vi.fn(),
      unlockSubmission: vi.fn(),
      clearError: vi.fn(),
      claimItem: vi.fn(),
      updateItemStatus: vi.fn(),
      fetchClaimedItems: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('routes a claimed submission-detail item into electronic processing with route state', async () => {
    const view = await renderComponent(<SubmissionDetail />);

    const workButton = findButton(view.container, 'Work on This');
    expect(workButton).toBeTruthy();

    await click(workButton);

    expect(mocks.navigate).toHaveBeenCalledWith('/admin/electronic/folio-course-123', {
      state: {
        processingContext: expect.objectContaining({
          submissionId: 31,
          itemId: 88,
          folioCourseListingId: 'folio-course-123',
          offeringId: 44,
          canOpenProcessing: true,
        }),
      },
    });

    view.unmount();
  });

  it('reopens a completed submission item from the work pane', async () => {
    const updateItemStatus = vi.fn().mockResolvedValue({ success: true });
    mocks.storeState.selectedSubmission.unfolderedItems = [{ ...submissionItem, status: 'complete' }];
    mocks.storeState.updateItemStatus = updateItemStatus;
    mocks.searchParams = new URLSearchParams('item=88');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const view = await renderComponent(<SubmissionDetail />);
    const reopenButton = findButton(view.container, 'Reopen for Processing');

    expect(reopenButton).toBeTruthy();
    mocks.storeState.fetchSubmissionDetail.mockClear();
    await click(reopenButton);

    expect(confirm).toHaveBeenCalledWith('Are you sure you want to reopen this item for processing?');
    expect(updateItemStatus).toHaveBeenCalledWith(88, 'in_progress');
    expect(mocks.storeState.fetchSubmissionDetail).toHaveBeenCalledWith('31');
    view.unmount();
  });

  it('routes a claimed-work queue item into electronic processing with route state', async () => {
    mocks.storeState.claimedItems = [
      {
        id: 88,
        resource_data: JSON.stringify({
          title: 'Handbook of Course Reserves',
          authors: 'A. Librarian',
          materialType: 'Book',
        }),
        submission: {
          course_code: 'ENG 101',
          faculty_display_name: 'Dr. Faculty',
        },
        processingContext,
      },
    ];

    const view = await renderComponent(<MyWorkQueue />);

    const processButton = findButton(view.container, 'Process');
    expect(processButton).toBeTruthy();

    await click(processButton);

    expect(mocks.navigate).toHaveBeenCalledWith('/admin/electronic/folio-course-123', {
      state: {
        processingContext: expect.objectContaining({
          submissionId: 31,
          itemId: 88,
          folioCourseListingId: 'folio-course-123',
          offeringId: 44,
          canOpenProcessing: true,
        }),
      },
    });

    view.unmount();
  });

  it('keeps blocked claimed-work queue items in place and shows the blocking reason', async () => {
    mocks.storeState.claimedItems = [
      {
        id: 88,
        resource_data: JSON.stringify({
          title: 'Handbook of Course Reserves',
          authors: 'A. Librarian',
          materialType: 'Book',
        }),
        submission: {
          course_code: 'ENG 101',
          faculty_display_name: 'Dr. Faculty',
        },
        processingContext: {
          ...processingContext,
          offeringId: null,
          canOpenProcessing: false,
          blockingReason: 'Submission is missing a local offering_id.',
        },
      },
    ];

    const view = await renderComponent(<MyWorkQueue />);

    const processButton = findButton(view.container, 'Process');
    expect(processButton).toBeTruthy();
    expect(processButton.disabled).toBe(true);
    expect(view.container.textContent).toContain('Submission is missing a local offering_id.');

    await click(processButton);

    expect(mocks.navigate).not.toHaveBeenCalled();

    view.unmount();
  });
});

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkQueueDetail from './WorkQueueDetail';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  workflowService: {
    getSubmissionCommunications: vi.fn(),
    updateItemStatus: vi.fn(),
  },
  checklistService: {
    getItemChecklist: vi.fn(),
    listTemplates: vi.fn(),
  },
  storeState: null,
  params: { itemId: '88' },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
}));

vi.mock('../store/submissionWorkflowStore', () => ({
  default: () => mocks.storeState,
}));

vi.mock('../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: mocks.workflowService,
}));

vi.mock('../services/admin/checklistService', () => ({
  checklistService: mocks.checklistService,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'test-staff' } }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const createItem = (updates = {}) => ({
  id: 88,
  submission_id: 31,
  resource_id: 901,
  title: 'test-Reserve title',
  course_code: 'test-ENG 101',
  course_title: 'test-Course title',
  instructor_name: 'test-Faculty',
  status: 'pending',
  item_type: 'submission',
  priority: 'high',
  processingContext: {
    submissionId: 31,
    itemId: 88,
    folioCourseListingId: 'test-folio-course',
    offeringId: 44,
    canOpenProcessing: true,
  },
  ...updates,
});

const mounted = new Set();

const renderComponent = async (item = createItem()) => {
  mocks.storeState = {
    claimedItems: [item],
    loading: false,
    error: null,
    fetchClaimedItems: vi.fn().mockResolvedValue(undefined),
    updateItemStatus: (...args) => mocks.workflowService.updateItemStatus(...args),
    clearError: vi.fn(),
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const view = {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
      mounted.delete(view);
    },
  };
  mounted.add(view);

  await act(async () => {
    root.render(createElement(WorkQueueDetail));
  });

  return view;
};

const click = async (element) => {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const findButton = (container, text) =>
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes(text));

const clickChannel = async (container, text) => {
  const button = Array.from(container.querySelectorAll('button.channel-item')).find((item) =>
    item.textContent.includes(text)
  );
  expect(button).toBeTruthy();
  expect(button.getAttribute('role') || 'button').toBe('button');
  await click(button);
};

const findBadge = (container, text) =>
  Array.from(container.querySelectorAll('.badge')).find((badge) => badge.textContent.trim() === text);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.navigate.mockReset();
  mocks.params = { itemId: '88' };
  mocks.workflowService.getSubmissionCommunications.mockResolvedValue([]);
  mocks.workflowService.updateItemStatus.mockResolvedValue({ item: createItem({ status: 'complete' }) });
  mocks.checklistService.getItemChecklist.mockRejectedValue(Object.assign(
    new Error('No checklist assigned to this item'),
    { status: 404 },
  ));
  mocks.checklistService.listTemplates.mockResolvedValue([]);
});

afterEach(async () => {
  for (const view of Array.from(mounted)) await view.unmount();
  vi.restoreAllMocks();
});

describe('WorkQueueDetail characterization', () => {
  it('renders the selected work-queue item', async () => {
    const view = await renderComponent();
    await clickChannel(view.container, 'Item Details');

    expect(view.container.textContent).toContain('test-Reserve title');
    expect(view.container.textContent).toContain('test-ENG 101');
    expect(view.container.textContent).toContain('test-Course title');
    expect(view.container.textContent).toContain('test-Faculty');
  });

  it('switches among the item details, checklist, and faculty panels', async () => {
    const view = await renderComponent();

    await clickChannel(view.container, 'Item Details');
    expect(view.container.textContent).toContain('Item Details');
    expect(view.container.textContent).toContain('Submission ID');

    await clickChannel(view.container, 'Checklist');
    expect(view.container.textContent).toContain('No Checklist Assigned');

    await clickChannel(view.container, 'Faculty Communication');
    expect(view.container.textContent).toContain('Faculty Messages (0)');
    expect(view.container.textContent).toContain('No faculty messages yet.');
  });

  it('sends a status change through the workflow service', async () => {
    const view = await renderComponent();
    await click(findButton(view.container, 'Pending'));
    await click(findButton(view.container, 'Complete'));

    expect(mocks.workflowService.updateItemStatus).toHaveBeenCalledWith(88, 'complete');
  });

  it('enables processing navigation when handoff data is valid', async () => {
    const view = await renderComponent();
    const action = findButton(view.container, 'Open Processing');

    expect(action.disabled).toBe(false);
    await click(action);
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/electronic/test-folio-course', {
      state: { processingContext: expect.objectContaining({ itemId: 88, canOpenProcessing: true }) },
    });
  });

  it('blocks processing navigation and displays the service reason when handoff is unavailable', async () => {
    const view = await renderComponent(createItem({
      processingContext: {
        folioCourseListingId: 'test-folio-course',
        canOpenProcessing: false,
        blockingReason: 'test-processing is blocked',
      },
    }));
    const action = findButton(view.container, 'Open Processing');

    expect(action.disabled).toBe(true);
    expect(action.title).toBe('test-processing is blocked');
    await clickChannel(view.container, 'Item Details');
    expect(view.container.textContent).toContain('test-processing is blocked');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('renders a badge for each item type and priority', async () => {
    const cases = [
      { item_type: 'submission', priority: 'high', type: 'Submission', priorityLabel: 'HIGH' },
      { item_type: 'purchase_request', priority: 'medium', type: 'Purchase Request', priorityLabel: 'MEDIUM' },
      { item_type: 'resource', priority: 'low', type: 'Resource', priorityLabel: 'LOW' },
    ];

    for (const item of cases) {
      const view = await renderComponent(createItem(item));
      expect(findBadge(view.container, item.type)).toBeTruthy();
      expect(findBadge(view.container, item.priorityLabel)).toBeTruthy();
      await view.unmount();
    }
  });
});

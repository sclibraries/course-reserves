import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from './testUtils/renderHook';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchClaimedItems: vi.fn(),
  updateItemStatus: vi.fn(),
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ itemId: '42' }),
}));
vi.mock('../../store/submissionWorkflowStore', () => ({
  default: () => ({
    claimedItems: [],
    loading: false,
    error: null,
    fetchClaimedItems: mocks.fetchClaimedItems,
    updateItemStatus: mocks.updateItemStatus,
    clearError: vi.fn(),
  }),
}));
vi.mock('../../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: { getSubmissionCommunications: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../services/notify', () => ({
  notify: { success: mocks.notifySuccess, fromError: mocks.notifyFromError, warning: vi.fn() },
}));

import useWorkQueueDetail from './useWorkQueueDetail';

let hook;

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.fetchClaimedItems.mockReset().mockResolvedValue([]);
  mocks.updateItemStatus.mockReset();
  mocks.notifySuccess.mockReset();
  mocks.notifyFromError.mockReset();
});

afterEach(() => {
  hook?.unmount();
  hook = null;
});

describe('useWorkQueueDetail status changes', () => {
  it('shows success only when the store confirms the update', async () => {
    mocks.updateItemStatus.mockResolvedValue({ success: true });
    hook = await renderHook(() => useWorkQueueDetail(), {});

    await hook.current.handleStatusChange(42, 'complete');

    expect(mocks.notifySuccess).toHaveBeenCalledWith('Status updated');
    expect(mocks.notifyFromError).not.toHaveBeenCalled();
    expect(mocks.fetchClaimedItems).toHaveBeenCalledTimes(2);
  });

  it('shows an error and skips refresh when the store rejects the update', async () => {
    mocks.updateItemStatus.mockResolvedValue({ success: false, error: 'Synthetic server detail' });
    hook = await renderHook(() => useWorkQueueDetail(), {});

    await hook.current.handleStatusChange(42, 'complete');

    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(mocks.notifyFromError).toHaveBeenCalledWith('Synthetic server detail', "Couldn't update the item status");
    expect(mocks.fetchClaimedItems).toHaveBeenCalledTimes(1);
  });
});

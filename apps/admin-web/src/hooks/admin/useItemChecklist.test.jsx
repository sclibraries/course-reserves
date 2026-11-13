import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from './testUtils/renderHook';

const mocks = vi.hoisted(() => ({
  assignChecklistToItem: vi.fn(),
  updateTaskStatus: vi.fn(),
  completeItemChecklist: vi.fn(),
  getItemChecklist: vi.fn(),
  listTemplates: vi.fn(),
}));
const notifications = vi.hoisted(() => {
  const toast = { id: 'synthetic-toast' };
  const notify = Object.fromEntries(['success', 'info', 'warning', 'error', 'fromError']
    .map((method) => [method, vi.fn(() => toast)]));
  return { toast, notify, toUserError: vi.fn(() => toast) };
});

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { username: 'synthetic-user' } }) }));
vi.mock('../../services/admin/checklistService', () => ({ checklistService: mocks }));
vi.mock('../../services/notify', () => ({ notify: notifications.notify, toUserError: notifications.toUserError }));

import useItemChecklist from './useItemChecklist';

const syntheticError = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-CHECKLIST-1' });
let hook;
let confirm;
let consoleError;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getItemChecklist.mockResolvedValue({ tasks: [{ id: 'task-1', completed: false }] });
  mocks.listTemplates.mockResolvedValue([]);
  mocks.assignChecklistToItem.mockResolvedValue({});
  mocks.updateTaskStatus.mockResolvedValue({});
  mocks.completeItemChecklist.mockResolvedValue({});
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  hook?.unmount();
  hook = null;
  confirm.mockRestore();
  consoleError.mockRestore();
});

async function renderChecklist(onComplete = vi.fn()) {
  hook = await renderHook(() => useItemChecklist('synthetic-item', onComplete), {});
  return onComplete;
}

describe('useItemChecklist notifications', () => {
  it.each([
    [
      'assignment',
      'Checklist assigned',
      "Couldn't assign the checklist",
      () => hook.current.handleAssignChecklist('synthetic-template'),
      () => mocks.assignChecklistToItem.mockRejectedValueOnce(syntheticError),
    ],
    [
      'task completion',
      'Task completed',
      "Couldn't update the checklist task",
      () => hook.current.handleTaskToggle('task-1', false),
      () => mocks.updateTaskStatus.mockRejectedValueOnce(syntheticError),
    ],
    [
      'item completion',
      'Item completed',
      "Couldn't complete the checklist",
      () => hook.current.handleCompleteAll(),
      () => mocks.completeItemChecklist.mockRejectedValueOnce(syntheticError),
    ],
  ])('announces %s success and failure', async (_action, successMessage, errorMessage, invoke, reject) => {
    const onComplete = await renderChecklist();
    await act(async () => invoke());
    expect(notifications.notify.success).toHaveBeenCalledWith(successMessage);
    if (_action === 'item completion') expect(onComplete).toHaveBeenCalledTimes(1);

    notifications.notify.success.mockClear();
    reject();
    await act(async () => invoke());
    expect(notifications.notify.fromError).toHaveBeenCalledWith(syntheticError, errorMessage);
    expect(notifications.notify.success).not.toHaveBeenCalled();
  });

  it('shows template load failures in an error toast with the reference', async () => {
    mocks.listTemplates.mockRejectedValueOnce(syntheticError);

    await renderChecklist();

    expect(notifications.notify.fromError).toHaveBeenCalledWith(syntheticError, "Couldn't load checklist templates");
  });
});

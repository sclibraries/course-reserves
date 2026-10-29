import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from './testUtils/renderHook';

const mocks = vi.hoisted(() => ({
  assignChecklistToItem: vi.fn(),
  updateTaskStatus: vi.fn(),
  completeItemChecklist: vi.fn(),
  getItemChecklist: vi.fn(),
  listTemplates: vi.fn(),
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { username: 'synthetic-user' } }) }));
vi.mock('../../services/admin/checklistService', () => ({ checklistService: mocks }));
vi.mock('../../services/notify', () => ({
  notify: { success: mocks.notifySuccess, fromError: mocks.notifyFromError },
}));

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
  it('announces assignment success and failure', async () => {
    await renderChecklist();
    await act(async () => hook.current.handleAssignChecklist('synthetic-template'));
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Checklist assigned');

    mocks.notifySuccess.mockClear();
    mocks.assignChecklistToItem.mockRejectedValueOnce(syntheticError);
    await act(async () => hook.current.handleAssignChecklist('synthetic-template'));
    expect(mocks.notifyFromError).toHaveBeenCalledWith(syntheticError, "Couldn't assign the checklist");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });

  it('announces task completion and failure', async () => {
    await renderChecklist();
    await act(async () => hook.current.handleTaskToggle('task-1', false));
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Task completed');

    mocks.notifySuccess.mockClear();
    mocks.updateTaskStatus.mockRejectedValueOnce(syntheticError);
    await act(async () => hook.current.handleTaskToggle('task-1', false));
    expect(mocks.notifyFromError).toHaveBeenCalledWith(syntheticError, "Couldn't update the checklist task");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });

  it('announces checklist completion and failure', async () => {
    const onComplete = await renderChecklist();
    await act(async () => hook.current.handleCompleteAll());
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Item completed');
    expect(onComplete).toHaveBeenCalledTimes(1);

    mocks.notifySuccess.mockClear();
    mocks.completeItemChecklist.mockRejectedValueOnce(syntheticError);
    await act(async () => hook.current.handleCompleteAll());
    expect(mocks.notifyFromError).toHaveBeenCalledWith(syntheticError, "Couldn't complete the checklist");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });
});

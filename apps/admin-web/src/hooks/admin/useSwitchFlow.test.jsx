import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { getByText } from '@testing-library/dom';

const mocks = vi.hoisted(() => ({ getFlows: vi.fn(), switchFlow: vi.fn() }));
const feedback = vi.hoisted(() => {
  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.dataset.testToast = 'true';
    toast.textContent = message;
    document.body.append(toast);
  };
  const notify = {
    success: vi.fn(showToast),
    info: vi.fn(showToast),
    warning: vi.fn(showToast),
    error: vi.fn(showToast),
    fromError: vi.fn(),
  };
  return { notify, toUserError: vi.fn() };
});

vi.mock('../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));
vi.mock('../../services/notify', () => ({ notify: feedback.notify, toUserError: feedback.toUserError }));

import { renderHook } from './testUtils/renderHook';
import useSwitchFlow from './useSwitchFlow';

const item = { kind: 'reuse', id: 99907812 };
const nextState = { flow: { id: 3, name: 'Article', version: 2 }, current_step: null, finished: null, history: [], can_act: true };

let hook;
const onChanged = vi.fn();
const onFlowStateChange = vi.fn();
const clearItemError = vi.fn();

beforeEach(() => {
  mocks.getFlows.mockReset().mockResolvedValue({ flows: [{ id: 3, name: 'Article' }] });
  mocks.switchFlow.mockReset().mockResolvedValue(nextState);
  onChanged.mockReset();
  onFlowStateChange.mockReset();
  clearItemError.mockReset();
  Object.values(feedback.notify).forEach((mock) => mock.mockClear());
  feedback.toUserError.mockClear();
});

afterEach(() => {
  hook?.unmount();
  hook = null;
  document.querySelectorAll('[data-test-toast]').forEach((toast) => toast.remove());
});

describe('useSwitchFlow', () => {
  it.each([
    ['Article', 'Switched to Article'],
    ['E-book', 'Switched to E-book'],
  ])('loads choices lazily and names the selected %s flow in the success toast', async (flowName, toastText) => {
    mocks.getFlows.mockResolvedValue({ flows: [{ id: 3, name: flowName }] });
    hook = await renderHook((props) => useSwitchFlow(props), {
      item, canAct: true, onFlowStateChange, onChanged, clearItemError,
    });

    expect(mocks.getFlows).not.toHaveBeenCalled();
    await act(async () => hook.current.openSwitchFlow());
    expect(mocks.getFlows).toHaveBeenCalledTimes(1);
    expect(hook.current.flows).toEqual([{ id: 3, name: flowName }]);
    expect(clearItemError).toHaveBeenCalledTimes(1);

    await act(async () => hook.current.setSelectedFlow('3'));
    await act(async () => hook.current.submitSwitchFlow('   '));
    expect(mocks.switchFlow).not.toHaveBeenCalled();

    await act(async () => hook.current.submitSwitchFlow('  Use the article process  '));
    expect(mocks.switchFlow).toHaveBeenCalledWith('reuse', 99907812, {
      flow_id: 3, reason: 'Use the article process',
    });
    expect(onFlowStateChange).toHaveBeenCalledWith(nextState);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(hook.current.open).toBe(false);
    expect(getByText(document.body, toastText)).toBeTruthy();
  });
});

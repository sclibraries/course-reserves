import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { getByText } from '@testing-library/dom';

const mocks = vi.hoisted(() => ({ getItemFlow: vi.fn(), submitStepResult: vi.fn() }));
const feedback = vi.hoisted(() => {
  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.dataset.testToast = 'true';
    toast.textContent = message;
    document.body.append(toast);
  };
  const toUserError = vi.fn((error, message = 'Something went wrong') => ({
    message,
    reference: error?.reference || error?.payload?.reference || error?.payload?.reference_id,
  }));
  const notify = {
    success: vi.fn(showToast),
    info: vi.fn(showToast),
    warning: vi.fn(showToast),
    error: vi.fn((message, { reference } = {}) => {
      const text = message.replace(/[.!?]+$/, '');
      showToast(reference ? `${text}. Reference: ${reference}` : text);
    }),
  };
  notify.fromError = vi.fn((error, message) => {
    const userError = toUserError(error, message);
    notify.error(userError.message, { reference: userError.reference });
  });
  return { notify, toUserError };
});

vi.mock('../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));
vi.mock('../../services/notify', () => ({ notify: feedback.notify, toUserError: feedback.toUserError }));

import { renderHook } from './testUtils/renderHook';
import useItemFlow from './useItemFlow';

const item = { kind: 'new', id: 99907811 };
const state = (stepKey = 'own_it', stepLabel = 'Process item') => ({
  flow: { id: 7, name: 'Print book', version: 1 },
  current_step: { step: { key: stepKey, kind: 'action', label: stepLabel, outcomes: [] } },
  finished: null, history: [], can_act: true,
});

let hook;
const onChanged = vi.fn();

beforeEach(() => {
  mocks.getItemFlow.mockReset().mockResolvedValue(state());
  mocks.submitStepResult.mockReset().mockResolvedValue(state('available'));
  onChanged.mockReset();
  Object.values(feedback.notify).forEach((mock) => mock.mockClear());
  feedback.toUserError.mockClear();
});

afterEach(() => {
  hook?.unmount();
  hook = null;
  document.querySelectorAll('[data-test-toast]').forEach((toast) => toast.remove());
});

describe('useItemFlow', () => {
  it.each([
    ['Process item', 'Recorded Process item'],
    ['Confirm format', 'Recorded Confirm format'],
  ])('loads and submits the current outcome, names the %s step, and exposes returned state', async (stepLabel, toastText) => {
    mocks.getItemFlow.mockResolvedValueOnce(state('own_it', stepLabel));
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });

    expect(mocks.getItemFlow).toHaveBeenCalledWith('new', 99907811);
    expect(hook.current.flowState.current_step.step.key).toBe('own_it');
    await actSubmit({ key: 'done', reason_required: false }, { notes: 'Located item' });

    expect(mocks.submitStepResult).toHaveBeenCalledWith('new', 99907811, {
      step_key: 'own_it', outcome_key: 'done', notes: 'Located item',
    });
    expect(hook.current.flowState.current_step.step.key).toBe('available');
    expect(hook.current.error).toBe('');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(getByText(document.body, toastText)).toBeTruthy();
  });

  it('reloads the flow and reports stale_step as a notice', async () => {
    mocks.getItemFlow.mockReset().mockResolvedValueOnce(state()).mockResolvedValueOnce(state('pull'));
    mocks.submitStepResult.mockRejectedValueOnce({ payload: { error_code: 'stale_step', reference: 'SYNTH-STALE' } });
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });
    const onStale = vi.fn();

    await actSubmit({ key: 'done' }, { onStale });

    expect(mocks.getItemFlow).toHaveBeenCalledTimes(2);
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(hook.current.flowState.current_step.step.key).toBe('pull');
    expect(hook.current.notice).toBe('Someone else moved this item on');
    expect(hook.current.error).toBe('');
    expect(getByText(document.body, "Couldn't record Process item. Reference: SYNTH-STALE")).toBeTruthy();
  });

  it('shows step_not_available_yet as a notice rather than an error', async () => {
    mocks.submitStepResult.mockRejectedValueOnce({ payload: { error_code: 'step_not_available_yet', reference: 'SYNTH-FOLIO' } });
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });

    await actSubmit({ key: 'done' });

    expect(hook.current.notice).toBe('FOLIO confirmation arrives in a later update');
    expect(hook.current.error).toBe('');
    expect(getByText(document.body, "Couldn't record Process item. Reference: SYNTH-FOLIO")).toBeTruthy();
  });

  it('exposes generic request errors', async () => {
    mocks.submitStepResult.mockRejectedValueOnce({ message: 'Connection lost', reference: 'SYNTH-STEP' });
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });

    await actSubmit({ key: 'done' });

    expect(hook.current.error).toBe('');
    expect(hook.current.notice).toBe('');
    expect(getByText(document.body, "Couldn't record Process item. Reference: SYNTH-STEP")).toBeTruthy();
  });
});

async function actSubmit(outcome, options = {}) {
  await act(async () => hook.current.submitOutcome(outcome, options));
}

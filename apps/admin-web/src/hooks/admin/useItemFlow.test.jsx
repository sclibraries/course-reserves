import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

const mocks = vi.hoisted(() => ({ getItemFlow: vi.fn(), submitStepResult: vi.fn() }));

vi.mock('../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));

import { renderHook } from './testUtils/renderHook';
import useItemFlow from './useItemFlow';

const item = { kind: 'new', id: 99907811 };
const state = (stepKey = 'own_it') => ({
  flow: { id: 7, name: 'Print book', version: 1 },
  current_step: { step: { key: stepKey, kind: 'action', label: 'Process item', outcomes: [] } },
  finished: null, history: [], can_act: true,
});

let hook;
const onChanged = vi.fn();

beforeEach(() => {
  mocks.getItemFlow.mockReset().mockResolvedValue(state());
  mocks.submitStepResult.mockReset().mockResolvedValue(state('available'));
  onChanged.mockReset();
});

afterEach(() => {
  hook?.unmount();
  hook = null;
});

describe('useItemFlow', () => {
  it('loads and submits the current outcome, then exposes the returned state', async () => {
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
  });

  it('reloads the flow and reports stale_step as a notice', async () => {
    mocks.getItemFlow.mockReset().mockResolvedValueOnce(state()).mockResolvedValueOnce(state('pull'));
    mocks.submitStepResult.mockRejectedValueOnce({ payload: { error_code: 'stale_step' } });
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });
    const onStale = vi.fn();

    await actSubmit({ key: 'done' }, { onStale });

    expect(mocks.getItemFlow).toHaveBeenCalledTimes(2);
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(hook.current.flowState.current_step.step.key).toBe('pull');
    expect(hook.current.notice).toBe('Someone else moved this item on');
    expect(hook.current.error).toBe('');
  });

  it('shows step_not_available_yet as a notice rather than an error', async () => {
    mocks.submitStepResult.mockRejectedValueOnce({ payload: { error_code: 'step_not_available_yet' } });
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });

    await actSubmit({ key: 'done' });

    expect(hook.current.notice).toBe('FOLIO confirmation arrives in a later update');
    expect(hook.current.error).toBe('');
  });

  it('exposes generic request errors', async () => {
    mocks.submitStepResult.mockRejectedValueOnce(new Error('Connection lost'));
    hook = await renderHook((props) => useItemFlow(props), { item, onChanged });

    await actSubmit({ key: 'done' });

    expect(hook.current.error).toBe('Connection lost');
    expect(hook.current.notice).toBe('');
  });
});

async function actSubmit(outcome, options = {}) {
  await act(async () => hook.current.submitOutcome(outcome, options));
}

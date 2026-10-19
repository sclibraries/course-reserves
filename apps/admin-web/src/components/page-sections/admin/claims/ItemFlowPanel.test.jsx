import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getItemFlow: vi.fn(),
  getFlows: vi.fn(),
  submitStepResult: vi.fn(),
  switchFlow: vi.fn(),
}));

vi.mock('../../../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));

import ItemFlowPanel from './ItemFlowPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = { kind: 'new', id: 99907811, title: 'Synthetic item' };
const initialFlow = () => ({
  flow: { id: 7, name: 'Print book', version: 1 },
  run_id: 91,
  current_step: {
    step: {
      key: 'own_it', kind: 'question', label: 'Do we own it?', help_text: 'Check the catalog.',
      outcomes: [{ key: 'yes', label: 'Yes', next: { step: 'available' }, reason_required: false }],
    },
  },
  finished: null,
  history: [{
    step_key: 'received', step_label: 'Request received', outcome_key: 'started', outcome_label: 'Started',
    notes: 'Synthetic note', reason: 'Synthetic reason', actor_display: 'Test Staff', created_at: '2026-10-19T12:00:00Z',
  }],
  can_act: true,
});

let root;
let container;
const onChanged = vi.fn();

async function renderPanel() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ItemFlowPanel item={item} onChanged={onChanged} />));
}

async function setValue(input, value) {
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getItemFlow.mockResolvedValue(initialFlow());
  mocks.getFlows.mockResolvedValue({ flows: [{ id: 3, name: 'Article', latest_version: 2, description: 'For articles', material_types: ['article'] }] });
  mocks.submitStepResult.mockResolvedValue({
    ...initialFlow(),
    current_step: { step: { key: 'available', kind: 'question', label: 'Is it available?', outcomes: [] } },
  });
  mocks.switchFlow.mockResolvedValue({
    ...initialFlow(), flow: { id: 3, name: 'Article', version: 2 },
  });
  onChanged.mockReset();
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('ItemFlowPanel', () => {
  it('loads the item flow, submits an outcome, then renders the returned state and history', async () => {
    await renderPanel();

    expect(mocks.getItemFlow).toHaveBeenCalledWith('new', 99907811);
    expect(container.textContent).toContain('Print book · version 1');
    expect(container.textContent).toContain('Check the catalog.');
    expect(container.textContent).toContain('Test Staff');
    expect(container.textContent).toContain('Synthetic note');

    await act(async () => container.querySelector('button[data-outcome-key="yes"]').click());

    expect(mocks.submitStepResult).toHaveBeenCalledWith('new', 99907811, {
      step_key: 'own_it', outcome_key: 'yes',
    });
    expect(container.textContent).toContain('Is it available?');
    expect(onChanged).toHaveBeenCalled();
  });

  it('sends action notes and requires confirmation plus a reason for a hand-off outcome', async () => {
    mocks.getItemFlow.mockResolvedValueOnce({
      ...initialFlow(),
      current_step: { step: {
        key: 'recall', kind: 'action', label: 'Recall it', outcomes: [
          { key: 'done', label: 'Done', next: { step: 'available' }, reason_required: false },
        ],
      } },
    });
    await renderPanel();

    await setValue(container.querySelector('textarea[name="flow-notes"]'), 'Recall sent to borrower');
    await act(async () => container.querySelector('button[data-outcome-key="done"]').click());
    expect(mocks.submitStepResult).toHaveBeenCalledWith('new', 99907811, {
      step_key: 'recall', outcome_key: 'done', notes: 'Recall sent to borrower',
    });

    mocks.getItemFlow.mockResolvedValueOnce({
      ...initialFlow(),
      current_step: { step: {
        key: 'own_it', kind: 'question', label: 'Do we own it?', outcomes: [
          { key: 'no', label: 'No', next: { handoff_group: 'Acquisitions' }, reason_required: true },
        ],
      } },
    });
    await act(async () => container.querySelector('button[aria-label="Reload item flow"]').click());
    await act(async () => container.querySelector('button[data-outcome-key="no"]').click());

    expect(container.textContent).toContain('This hands the item to Acquisitions');
    expect(mocks.submitStepResult).toHaveBeenCalledTimes(1);
    const confirm = container.querySelector('button[data-action="confirm-outcome"]');
    expect(confirm.disabled).toBe(true);
    await setValue(container.querySelector('textarea[name="flow-reason"]'), 'Order is needed');
    expect(confirm.disabled).toBe(false);
    await act(async () => confirm.click());
    expect(mocks.submitStepResult).toHaveBeenLastCalledWith('new', 99907811, {
      step_key: 'own_it', outcome_key: 'no', reason: 'Order is needed',
    });
  });

  it('disables outcome buttons when the current staff member does not hold the claim', async () => {
    mocks.getItemFlow.mockResolvedValueOnce({ ...initialFlow(), can_act: false });
    await renderPanel();

    expect(container.textContent).toContain('Claim this item to work on it');
    expect(container.querySelector('button[data-outcome-key="yes"]').disabled).toBe(true);
    expect(mocks.submitStepResult).not.toHaveBeenCalled();
  });

  it('reloads on a stale step and shows unavailable FOLIO confirmation as an informational notice', async () => {
    mocks.submitStepResult.mockRejectedValueOnce({ payload: { error_code: 'stale_step' } });
    mocks.getItemFlow
      .mockResolvedValueOnce(initialFlow())
      .mockResolvedValueOnce({
        ...initialFlow(), current_step: { step: {
          key: 'pull', kind: 'action', label: 'Pull it',
          outcomes: [{ key: 'done', label: 'Done', next: { step: 'confirm' }, reason_required: false }],
        } },
      });
    await renderPanel();
    await act(async () => container.querySelector('button[data-outcome-key="yes"]').click());

    expect(mocks.getItemFlow).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Someone else moved this item on');
    expect(container.textContent).toContain('Pull it');

    mocks.submitStepResult.mockRejectedValueOnce({ payload: { error_code: 'step_not_available_yet' } });
    await act(async () => container.querySelector('button[data-outcome-key="done"]').click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain('FOLIO confirmation arrives in a later update');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('requires a reason to switch flows and renders the returned flow', async () => {
    await renderPanel();
    await act(async () => container.querySelector('button[data-action="open-switch-flow"]').click());

    expect(mocks.getFlows).toHaveBeenCalledTimes(1);
    const select = container.querySelector('select[name="flow-id"]');
    await setValue(select, '3');
    const submit = container.querySelector('button[data-action="switch-flow"]');
    expect(submit.disabled).toBe(true);
    await setValue(container.querySelector('textarea[name="switch-reason"]'), 'Use the article process');
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());

    expect(mocks.switchFlow).toHaveBeenCalledWith('new', 99907811, {
      flow_id: 3, reason: 'Use the article process',
    });
    expect(container.textContent).toContain('Article · version 2');
  });

  it('shows finished state without outcome buttons and offers switch flow when no mapping exists', async () => {
    mocks.getItemFlow.mockResolvedValueOnce({
      ...initialFlow(), current_step: null, finished: { finish_state: 'unavailable', reason: 'Not available from suppliers' },
    });
    await renderPanel();

    expect(container.textContent).toContain('Finished: Unavailable');
    expect(container.textContent).toContain('Not available from suppliers');
    expect(container.querySelector('[data-outcome-key]')).toBeNull();

    await act(async () => root.unmount());
    root = null;
    container.remove();
    container = null;
    mocks.getItemFlow.mockResolvedValueOnce({ ...initialFlow(), flow: null, current_step: null });
    await renderPanel();
    expect(container.textContent).toContain('No flow is set for this material type');
    expect(container.querySelector('button[data-action="open-switch-flow"]')).not.toBeNull();
  });
});

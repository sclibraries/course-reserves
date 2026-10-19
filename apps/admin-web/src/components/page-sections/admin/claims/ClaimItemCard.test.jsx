import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  claimItem: vi.fn(),
  releaseItem: vi.fn(),
  handoffItem: vi.fn(),
  takeoverItem: vi.fn(),
  getStaff: vi.fn(),
  getGroupsForHandoff: vi.fn(),
  getItemTimeline: vi.fn(),
  getItemFlow: vi.fn(),
  getFlows: vi.fn(),
  submitStepResult: vi.fn(),
  switchFlow: vi.fn(),
}));

vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));
vi.mock('../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));
vi.mock('../../../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));

import ClaimItemCard from './ClaimItemCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = {
  kind: 'new', id: 99907801, submission_id: 54, submission_uuid: 'synthetic-api078-submission',
  course_code: 'TST 101', section: '01', term_code: '2026FA', title: 'Synthetic item',
  material_type: 'book', position: 1, status: 'pending', claimed_by: 'test-api078-owner',
  claimed_by_display: 'Test Owner', expires_at: '2026-10-20T12:00:00Z',
};

let root;
let container;
const onChanged = vi.fn();

async function renderCard(claim = item) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ClaimItemCard item={claim} currentUsername="test-api078-staff" onChanged={onChanged} />));
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.claimItem.mockResolvedValue({ item });
  mocks.releaseItem.mockResolvedValue({ item });
  mocks.handoffItem.mockResolvedValue({ item });
  mocks.takeoverItem.mockResolvedValue({ item });
  mocks.getStaff.mockResolvedValue({ items: [{ username: 'test-api078-handler', display_name: 'Test Handler' }] });
  mocks.getGroupsForHandoff.mockResolvedValue({ groups: [{ id: 7, name: 'Synthetic acquisitions' }] });
  mocks.getItemTimeline.mockResolvedValue({ items: [{ event_type: 'claimed', actor: 'test-api078-staff', created_at: '2026-10-19T12:00:00Z' }] });
  mocks.getItemFlow.mockResolvedValue({ flow: null, current_step: null, finished: null, history: [], can_act: true });
  onChanged.mockReset();
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('ClaimItemCard', () => {
  it('requires a non-empty reason before taking over an item', async () => {
    await renderCard();
    await act(async () => container.querySelector('button[aria-label="Take over Synthetic item"]').click());
    const submit = container.querySelector('button[type="submit"][data-action="takeover"]');

    expect(submit.disabled).toBe(true);
    const reason = container.querySelector('textarea[name="takeover-reason"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(reason, '  Urgent review  ');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(submit.disabled).toBe(false);

    await act(async () => submit.click());

    expect(mocks.takeoverItem).toHaveBeenCalledWith('new', 99907801, { reason: 'Urgent review' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('loads staff choices and hands the item to the selected username', async () => {
    await renderCard();
    await act(async () => container.querySelector('button[aria-label="Hand off Synthetic item"]').click());

    expect(mocks.getStaff).toHaveBeenCalledWith('');
    const staffPicker = container.querySelector('select[name="to_username"]');
    await act(async () => {
      staffPicker.value = 'test-api078-handler';
      staffPicker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => container.querySelector('button[type="submit"][data-action="handoff"]').click());

    expect(mocks.handoffItem).toHaveBeenCalledWith('new', 99907801, { to_username: 'test-api078-handler' });
  });

  it('hands an item off to a selected group', async () => {
    await renderCard();
    await act(async () => container.querySelector('button[aria-label="Hand off Synthetic item"]').click());
    const targetType = container.querySelector('select[name="handoff-target-type"]');
    await act(async () => {
      targetType.value = 'group';
      targetType.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mocks.getGroupsForHandoff).toHaveBeenCalled();
    const groupPicker = container.querySelector('select[name="to_group_id"]');
    await act(async () => {
      groupPicker.value = '7';
      groupPicker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => container.querySelector('button[type="submit"][data-action="handoff"]').click());

    expect(mocks.handoffItem).toHaveBeenCalledWith('new', 99907801, { to_group_id: 7 });
  });

  it('loads and displays the item timeline using the shared timeline component', async () => {
    await renderCard();
    await act(async () => container.querySelector('button[aria-label="Show timeline for Synthetic item"]').click());

    expect(mocks.getItemTimeline).toHaveBeenCalledWith('new', 99907801);
    expect(container.textContent).toContain('Item timeline: Synthetic item');
    expect(container.textContent).toContain('claimed');
  });

  it('shows the current flow step in the item claim card', async () => {
    await renderCard({ ...item, current_step_label: 'Pull it from the shelf' });

    expect(container.textContent).toContain('Current step: Pull it from the shelf');
  });

  it('opens the item flow from its claim card', async () => {
    await renderCard();
    await act(async () => container.querySelector('button[aria-label="Show item flow for Synthetic item"]').click());

    expect(mocks.getItemFlow).toHaveBeenCalledWith('new', 99907801);
    expect(container.textContent).toContain('No flow is set for this material type');
  });
});

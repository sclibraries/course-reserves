import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllByText, getByRole, getByText, queryByRole, queryByText, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

const mocks = vi.hoisted(() => ({
  claimItem: vi.fn(), releaseItem: vi.fn(), handoffItem: vi.fn(), takeoverItem: vi.fn(),
  getStaff: vi.fn(), getGroupsForHandoff: vi.fn(), getItemTimeline: vi.fn(), getItemFlow: vi.fn(),
  getFlows: vi.fn(), setAccessPath: vi.fn(), submitStepResult: vi.fn(), switchFlow: vi.fn(),
  createCommunication: vi.fn(), searchStaff: vi.fn(),
}));

vi.mock('../../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));
vi.mock('../../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));
vi.mock('../../../../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));
vi.mock('../../../../../services/admin/submissionWorkflowService', () => ({ submissionWorkflowService: mocks }));

import ItemWorkPane from './ItemWorkPane';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

const item = {
  kind: 'new', id: 7501, title: 'Synthetic reserve item', status: 'in_progress',
  claimed_by: 'synthetic-staff', claimed_by_display: 'Synthetic Staff',
  readiness: 'missing', accessPath: '', allowedAccessPaths: ['purchase'],
};

function flowState(overrides = {}) {
  return {
    flow: { id: 7, name: 'Synthetic flow', version: 1 },
    current_step: { step: {
      key: 'own_it', kind: 'question', label: 'Do we own it?', help_text: 'Check the catalog.',
      outcomes: [
        { key: 'yes', label: 'Yes', next: { step: 'available' }, reason_required: false },
        { key: 'no', label: 'No', next: { step: 'order' }, reason_required: false },
      ],
    } },
    finished: null, history: [], can_act: true,
    ...overrides,
  };
}

function PaneHarness({ initialItem, refreshClaim, onReopen }) {
  const [currentItem, setCurrentItem] = useState(initialItem);
  const onChanged = () => {
    if (refreshClaim && !currentItem.claimed_by) {
      setCurrentItem({ ...currentItem, claimed_by: 'synthetic-staff', claimed_by_display: 'Synthetic Staff' });
    }
  };
  return (
    <ItemWorkPane
      item={currentItem}
      currentUsername="synthetic-staff"
      onChanged={onChanged}
      onGoToWork={() => {}}
      onReopen={onReopen}
    />
  );
}

PaneHarness.propTypes = {
  initialItem: PropTypes.object.isRequired,
  refreshClaim: PropTypes.bool,
  onReopen: PropTypes.func.isRequired,
};

let root;
let container;

function actUser() {
  const user = userEvent.setup();
  return { click: (...args) => act(async () => user.click(...args)) };
}

async function renderPane({ paneItem = item, refreshClaim = false, onReopen = vi.fn() } = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const user = actUser();
  await act(async () => root.render(
    <PaneHarness initialItem={paneItem} refreshClaim={refreshClaim} onReopen={onReopen} />,
  ));
  return { user, pane: container, onReopen };
}

async function expectAccessible(target) {
  expect(await axe(target)).toHaveNoViolations();
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.claimItem.mockResolvedValue({ item });
  mocks.releaseItem.mockResolvedValue({ item });
  mocks.handoffItem.mockResolvedValue({ item });
  mocks.takeoverItem.mockResolvedValue({ item });
  mocks.getStaff.mockResolvedValue({ items: [] });
  mocks.getGroupsForHandoff.mockResolvedValue({ groups: [] });
  mocks.getItemTimeline.mockResolvedValue({ items: [] });
  mocks.getItemFlow.mockResolvedValue(flowState());
  mocks.getFlows.mockResolvedValue({ flows: [{ id: 3, name: 'Alternate synthetic flow' }] });
  mocks.setAccessPath.mockResolvedValue({ access_path: 'purchase' });
  mocks.submitStepResult.mockResolvedValue(flowState());
  mocks.switchFlow.mockResolvedValue(flowState());
  mocks.createCommunication.mockResolvedValue({ id: 1 });
  mocks.searchStaff.mockResolvedValue([]);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('ItemWorkPane claim state', () => {
  it('shows one claim notice and calls the shared claim action', async () => {
    const { pane, user } = await renderPane({ paneItem: { ...item, claimed_by: null, claimed_by_display: null } });
    const process = getByRole(pane, 'region', { name: 'Process Synthetic reserve item' });

    expect(getAllByText(process, 'Claim this item to work on it', { exact: true })).toHaveLength(1);
    expect(queryByRole(process, 'heading', { name: 'How will we get it?' })).toBeNull();
    expect(queryByText(process, 'Only the staff member who holds the claim can set the access path.')).toBeNull();
    expect(queryByText(process, 'Use the claim controls above to claim this item.')).toBeNull();
    await expectAccessible(pane);
    await user.click(getByRole(process, 'button', { name: 'Claim item' }));
    expect(mocks.claimItem).toHaveBeenCalledWith('new', 7501);
  });

  it('reloads the flow after claiming and enables outcomes without manual reload', async () => {
    mocks.getItemFlow
      .mockResolvedValueOnce(flowState({ can_act: false }))
      .mockResolvedValueOnce(flowState({ can_act: true }));
    const { pane, user } = await renderPane({ paneItem: { ...item, claimed_by: null }, refreshClaim: true });
    const process = getByRole(pane, 'region', { name: 'Process Synthetic reserve item' });
    expect(queryByRole(process, 'button', { name: 'Yes' })).toBeNull();

    await user.click(getByRole(process, 'button', { name: 'Claim item' }));
    await waitFor(() => expect(getByRole(process, 'button', { name: 'Yes' }).disabled).toBe(false));

    expect(mocks.getItemFlow).toHaveBeenCalledTimes(2);
    expect(getByRole(process, 'button', { name: 'Reload item flow' })).toBeTruthy();
  });

  it('shows the formatted group claim refusal next to the Claim button', async () => {
    mocks.claimItem.mockRejectedValueOnce({ payload: { error_code: 'not_group_member' } });
    const assigned = { id: 12, name: 'Acquisitions' };
    const { pane, user } = await renderPane({ paneItem: { ...item, claimed_by: null, assigned_group: assigned } });
    const process = getByRole(pane, 'region', { name: 'Process Synthetic reserve item' });

    expect(getByText(process, 'Assigned to Acquisitions. Claim this item to work on it')).toBeTruthy();
    await user.click(getByRole(process, 'button', { name: 'Claim item' }));
    expect((await waitFor(() => getByRole(process, 'alert'))).textContent)
      .toBe('Only group members can claim this; use Take over with a reason.');
    await expectAccessible(pane);
  });

  it('shows the existing access path when another staff member holds the claim', async () => {
    const { pane } = await renderPane({ paneItem: {
      ...item, claimed_by: 'another-staff', claimed_by_display: 'Another Staff', accessPath: 'purchase',
    } });
    const process = getByRole(pane, 'region', { name: 'Process Synthetic reserve item' });

    expect(getByRole(process, 'heading', { name: 'How will we get it?' })).toBeTruthy();
    expect(getByText(process, 'Current path: Purchase')).toBeTruthy();
  });

  it('does not offer Claim for an unclaimed complete item and keeps Reopen', async () => {
    const onReopen = vi.fn();
    const { pane, user } = await renderPane({
      paneItem: { ...item, status: 'complete', claimed_by: null }, onReopen,
    });
    expect(queryByRole(pane, 'button', { name: /^Claim/ })).toBeNull();
    expect(queryByText(pane, 'Claim this item to work on it')).toBeNull();
    await user.click(getByRole(pane, 'button', { name: 'Reopen for Processing' }));
    expect(onReopen).toHaveBeenCalledWith(7501);
  });

  it.each([
    ['no flow', flowState({ flow: null, current_step: null })],
    ['finished flow', flowState({ current_step: null, finished: { finish_state: 'available', reason: '' } })],
  ])('shows the existing path for a %s without a current step', async (_label, state) => {
    mocks.getItemFlow.mockResolvedValueOnce(state);
    const { pane } = await renderPane({ paneItem: { ...item, accessPath: 'purchase' } });
    expect(getByText(pane, 'Current path: Purchase')).toBeTruthy();
  });

  it('places action controls before the access path and keeps Switch flow open for another claimant', async () => {
    const actionFlow = flowState({ current_step: { step: {
      key: 'order', kind: 'action', label: 'Order a copy', outcomes: [
        { key: 'ordered', label: 'Ordered', next: { step: 'confirm' }, reason_required: true },
      ],
    } } });
    mocks.getItemFlow.mockResolvedValueOnce(actionFlow);
    const { pane, user } = await renderPane({ paneItem: { ...item, accessPath: 'purchase' } });
    const process = getByRole(pane, 'region', { name: 'Process Synthetic reserve item' });
    const pathHeading = getByRole(process, 'heading', { name: 'How will we get it?' });
    const notes = getByRole(process, 'textbox', { name: 'Action notes' });
    const outcome = getByRole(process, 'button', { name: 'Ordered' });

    expect(notes.compareDocumentPosition(pathHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(outcome.compareDocumentPosition(pathHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(outcome);
    for (const control of [
      getByRole(process, 'textbox', { name: 'Reason (required)' }),
      getByRole(process, 'button', { name: 'Confirm outcome' }),
      getByRole(process, 'button', { name: 'Cancel' }),
    ]) {
      expect(control.compareDocumentPosition(pathHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('opens Switch flow while another staff member holds the claim', async () => {
    mocks.getItemFlow.mockResolvedValueOnce(flowState({ can_act: false }));
    const { pane, user } = await renderPane({ paneItem: {
      ...item, claimed_by: 'another-staff', claimed_by_display: 'Another Staff',
    } });
    const otherProcess = getByRole(pane, 'region', { name: 'Process Synthetic reserve item' });
    await user.click(getByRole(otherProcess, 'button', { name: 'Switch flow' }));
    expect(getByRole(document.body, 'dialog', { name: 'Switch flow' })).toBeTruthy();
    expect(within(getByRole(document.body, 'dialog', { name: 'Switch flow' })).getByRole('status').textContent)
      .toBe('Claim this item to work on it.');
  });
});

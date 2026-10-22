import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getByRole, getByText, queryByRole, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

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
  createCommunication: vi.fn(),
  searchStaff: vi.fn(),
}));

vi.mock('../../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));
vi.mock('../../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));
vi.mock('../../../../../services/admin/workflowFlows/workflowFlowsApi', () => ({ workflowFlowsApi: mocks }));
vi.mock('../../../../../services/admin/submissionWorkflowService', () => ({ submissionWorkflowService: mocks }));

import ItemWorkPane from './ItemWorkPane';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

const item = {
  kind: 'new',
  id: 99907851,
  submission_id: 54,
  submission_uuid: 'synthetic-aw059-submission',
  title: 'Synthetic item',
  material_type: 'book',
  status: 'in_progress',
  claimed_by: 'test-api078-staff',
  claimed_by_display: 'Test Owner',
  authors: 'Synthetic Author',
  publicationYear: '2026',
  doi: '10.1000/aw059',
  issn: '1234-5678',
  journalTitle: 'Synthetic Journal',
  volume: '12',
  issue: '3',
  barcode: 'SYNTHETIC-28',
  callNumber: 'QA 100 .S95',
  facultyNotes: 'Use the first chapter.',
  staffNotes: 'Check the reserve shelf.',
  eds: { plink: 'https://search.ebscohost.com/record/synthetic-aw059' },
  url: 'https://example.edu/resource',
  unreadCommunications: 1,
  communications: [{
    id: 2801,
    sender_name: 'Synthetic Faculty',
    sender_type: 'faculty',
    subject: 'Reserve timing',
    message: 'Please have this ready before classes begin.',
    category: 'question',
    visibility: 'faculty_visible',
    created_at: '2026-10-19T12:00:00Z',
    is_read: false,
    replies: [],
  }],
  processingContext: {
    submissionId: 54,
    itemId: 99907851,
    folioCourseListingId: 320,
    courseLinked: true,
    canOpenProcessing: true,
  },
};

const submission = {
  course_code: 'TST 101',
  course_title: 'Synthetic Course',
  faculty_display_name: 'Synthetic Faculty',
  faculty_email: 'faculty@example.edu',
};

function flowState(overrides = {}) {
  return {
    flow: { id: 7, name: 'Print book', version: 1 },
    run_id: 91,
    current_step: {
      step: {
        key: 'own_it',
        kind: 'question',
        label: 'Do we own it?',
        help_text: 'Check the catalog.',
        outcomes: [
          { key: 'yes', label: 'Yes', next: { step: 'available' }, reason_required: false },
          { key: 'no', label: 'No', next: { step: 'recall' }, reason_required: false },
        ],
      },
    },
    finished: null,
    history: [{
      step_key: 'received',
      step_label: 'Request received',
      outcome_key: 'started',
      outcome_label: 'Started',
      notes: 'Synthetic flow note',
      reason: 'Synthetic flow reason',
      actor_display: 'Synthetic Staff',
      created_at: '2026-10-18T12:00:00Z',
    }],
    can_act: true,
    ...overrides,
  };
}

let root;
let container;

function actUser() {
  const user = userEvent.setup();
  return {
    click: (...args) => act(async () => user.click(...args)),
    type: (...args) => act(async () => user.type(...args)),
    selectOptions: (...args) => act(async () => user.selectOptions(...args)),
  };
}

async function renderPane(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const user = actUser();
  await act(async () => root.render(
    <ItemWorkPane
      item={item}
      submission={submission}
      currentUsername="test-api078-staff"
      onChanged={vi.fn()}
      onGoToWork={vi.fn()}
      onReopen={vi.fn()}
      {...props}
    />,
  ));
  return { user, container };
}

async function expectAccessible(target = container) {
  expect(await axe(target)).toHaveNoViolations();
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.claimItem.mockResolvedValue({ item });
  mocks.releaseItem.mockResolvedValue({ item });
  mocks.handoffItem.mockResolvedValue({ item });
  mocks.takeoverItem.mockResolvedValue({ item });
  mocks.getStaff.mockResolvedValue({ items: [{ username: 'test-api078-handler', display_name: 'Test Handler' }] });
  mocks.getGroupsForHandoff.mockResolvedValue({ groups: [{ id: 7, name: 'Synthetic acquisitions' }] });
  mocks.getItemTimeline.mockResolvedValue({ items: [{
    event_type: 'claimed',
    actor: 'Synthetic Staff',
    created_at: '2026-10-19T12:00:00Z',
  }] });
  mocks.getItemFlow.mockResolvedValue(flowState());
  mocks.getFlows.mockResolvedValue({ flows: [{ id: 3, name: 'Article', latest_version: 2 }] });
  mocks.submitStepResult.mockResolvedValue(flowState({
    current_step: { step: { key: 'available', kind: 'question', label: 'Is it available?', outcomes: [] } },
  }));
  mocks.switchFlow.mockResolvedValue(flowState({ flow: { id: 3, name: 'Article', version: 2 } }));
  mocks.createCommunication.mockResolvedValue({ id: 2802, message: 'Synthetic reply' });
  mocks.searchStaff.mockResolvedValue([]);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('ItemWorkPane claim actions', () => {
  it('offers Claim and hides actions that require an existing claim', async () => {
    const { container: pane } = await renderPane({ item: { ...item, claimed_by: null } });

    expect(getByRole(pane, 'button', { name: 'Claim Synthetic item' })).toBeTruthy();
    expect(getByText(pane, 'Use the claim controls above to claim this item.')).toBeTruthy();
    expect(queryByRole(pane, 'button', { name: 'Release Synthetic item' })).toBeNull();
    expect(queryByRole(pane, 'button', { name: 'Hand off Synthetic item' })).toBeNull();
    expect(queryByRole(pane, 'button', { name: 'Take over Synthetic item' })).toBeNull();
  });

  it('offers Release and Hand off to the current claimant', async () => {
    const { container: pane } = await renderPane();

    expect(getByRole(pane, 'button', { name: 'Release Synthetic item' })).toBeTruthy();
    expect(getByRole(pane, 'button', { name: 'Hand off Synthetic item' })).toBeTruthy();
    expect(queryByRole(pane, 'button', { name: 'Take over Synthetic item' })).toBeNull();
  });

  it('offers Hand off and Take over when another staff member holds the claim', async () => {
    const { container: pane } = await renderPane({ item: { ...item, claimed_by: 'test-api078-owner' } });

    expect(getByRole(pane, 'button', { name: 'Hand off Synthetic item' })).toBeTruthy();
    expect(getByRole(pane, 'button', { name: 'Take over Synthetic item' })).toBeTruthy();
    expect(queryByRole(pane, 'button', { name: 'Release Synthetic item' })).toBeNull();
  });

  it('claims an unclaimed item', async () => {
    const { user } = await renderPane({ item: { ...item, claimed_by: null } });

    await user.click(getByRole(container, 'button', { name: 'Claim Synthetic item' }));

    expect(mocks.claimItem).toHaveBeenCalledWith('new', 99907851);
  });

  it('hands an item to a selected staff member', async () => {
    const { user } = await renderPane();
    await user.click(getByRole(container, 'button', { name: 'Hand off Synthetic item' }));
    const dialog = getByRole(document.body, 'dialog', { name: 'Hand off Synthetic item' });
    await waitFor(() => expect(mocks.getStaff).toHaveBeenCalledWith(''));
    await expectAccessible(document.body);
    const staffSelect = within(dialog).getByRole('combobox', { name: 'Staff member' });
    await waitFor(() => expect(staffSelect.querySelector('option[value="test-api078-handler"]')).toBeTruthy());
    await user.selectOptions(staffSelect, 'test-api078-handler');
    await user.click(within(dialog).getByRole('button', { name: 'Send handoff' }));

    expect(mocks.getStaff).toHaveBeenCalledWith('');
    expect(mocks.handoffItem).toHaveBeenCalledWith('new', 99907851, { to_username: 'test-api078-handler' });
  });

  it('hands an item to a selected group', async () => {
    const { user } = await renderPane();
    await user.click(getByRole(container, 'button', { name: 'Hand off Synthetic item' }));
    const dialog = getByRole(document.body, 'dialog', { name: 'Hand off Synthetic item' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Recipient type' }), 'group');
    await waitFor(() => expect(mocks.getGroupsForHandoff).toHaveBeenCalled());
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Staff group' }).querySelector('option[value="7"]')).toBeTruthy());
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Staff group' }), '7');
    await user.click(within(dialog).getByRole('button', { name: 'Send handoff' }));

    expect(mocks.getGroupsForHandoff).toHaveBeenCalled();
    expect(mocks.handoffItem).toHaveBeenCalledWith('new', 99907851, { to_group_id: 7 });
  });

  it('requires a non-empty reason before taking over an item', async () => {
    const { user } = await renderPane({ item: { ...item, claimed_by: 'test-api078-owner' } });
    await user.click(getByRole(container, 'button', { name: 'Take over Synthetic item' }));
    const dialog = getByRole(document.body, 'dialog', { name: 'Take over Synthetic item' });
    await expectAccessible(document.body);
    const submit = within(dialog).getByRole('button', { name: 'Take over item' });

    expect(submit.disabled).toBe(true);
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason for taking over (required)' }), '  Urgent review  ');
    expect(submit.disabled).toBe(false);
    await user.click(submit);

    expect(mocks.takeoverItem).toHaveBeenCalledWith('new', 99907851, { reason: 'Urgent review' });
  });
});

describe('ItemWorkPane process and history', () => {
  it('shows the flow question and posts the selected outcome', async () => {
    const { user } = await renderPane();

    expect(getByRole(container, 'heading', { name: 'Do we own it?' })).toBeTruthy();
    expect(getByText(container, 'Check the catalog.')).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'Yes' }).className).toContain('tw-bg-primary');
    expect(getByRole(container, 'button', { name: 'No' }).className).toContain('tw-border-input');
    await expectAccessible();
    await user.click(getByRole(container, 'button', { name: 'Yes' }));

    await waitFor(() => expect(mocks.submitStepResult).toHaveBeenCalledWith('new', 99907851, {
      step_key: 'own_it', outcome_key: 'yes',
    }));
    expect(getByRole(container, 'heading', { name: 'Is it available?' })).toBeTruthy();
  });

  it('sends action notes and requires a reason for a handoff outcome', async () => {
    mocks.getItemFlow.mockResolvedValueOnce(flowState({
      current_step: { step: {
        key: 'recall', kind: 'action', label: 'Recall it',
        outcomes: [{ key: 'done', label: 'Done', next: { step: 'available' }, reason_required: false }],
      } },
    }));
    const { user } = await renderPane();

    await user.type(getByRole(container, 'textbox', { name: 'Action notes' }), 'Recall sent to borrower');
    await user.click(getByRole(container, 'button', { name: 'Done' }));
    await waitFor(() => expect(mocks.submitStepResult).toHaveBeenCalledWith('new', 99907851, {
      step_key: 'recall', outcome_key: 'done', notes: 'Recall sent to borrower',
    }));

    mocks.getItemFlow.mockResolvedValueOnce(flowState({
      current_step: { step: {
        key: 'own_it', kind: 'question', label: 'Do we own it?', outcomes: [
          { key: 'no', label: 'No', next: { handoff_group: 'Acquisitions' }, reason_required: true },
        ],
      } },
    }));
    await user.click(getByRole(container, 'button', { name: 'Reload item flow' }));
    await waitFor(() => expect(getByRole(container, 'heading', { name: 'Do we own it?' })).toBeTruthy());
    await user.click(getByRole(container, 'button', { name: 'No' }));
    const confirm = getByRole(container, 'button', { name: 'Confirm outcome' });

    expect(getByText(container, 'This hands the item to Acquisitions')).toBeTruthy();
    expect(confirm.disabled).toBe(true);
    expect(mocks.submitStepResult).toHaveBeenCalledTimes(1);
    await user.type(getByRole(container, 'textbox', { name: 'Reason (required)' }), 'Order is needed');
    await user.click(confirm);

    await waitFor(() => expect(mocks.submitStepResult).toHaveBeenLastCalledWith('new', 99907851, {
      step_key: 'own_it', outcome_key: 'no', reason: 'Order is needed',
    }));
  });

  it('disables outcomes when the current staff member does not hold the claim', async () => {
    mocks.getItemFlow.mockResolvedValueOnce(flowState({ can_act: false }));
    const { container: pane } = await renderPane();

    expect(getByText(pane, 'Claim this item to work on it')).toBeTruthy();
    expect(getByRole(pane, 'button', { name: 'Yes' }).disabled).toBe(true);
    expect(mocks.submitStepResult).not.toHaveBeenCalled();
  });

  it('reloads a stale step and announces when FOLIO confirmation is not available yet', async () => {
    mocks.submitStepResult
      .mockRejectedValueOnce({ payload: { error_code: 'stale_step' } })
      .mockRejectedValueOnce({ payload: { error_code: 'step_not_available_yet' } });
    mocks.getItemFlow
      .mockResolvedValueOnce(flowState())
      .mockResolvedValueOnce(flowState({ current_step: { step: {
        key: 'pull', kind: 'action', label: 'Pull it',
        outcomes: [{ key: 'done', label: 'Done', next: { step: 'confirm' }, reason_required: false }],
      } } }));
    const { user } = await renderPane();
    await user.click(getByRole(container, 'button', { name: 'Yes' }));

    await waitFor(() => expect(getByText(container, 'Someone else moved this item on')).toBeTruthy());
    expect(getByRole(container, 'heading', { name: 'Pull it' })).toBeTruthy();
    await user.click(getByRole(container, 'button', { name: 'Done' }));
    await waitFor(() => expect(getByRole(container, 'status').textContent).toContain('FOLIO confirmation arrives in a later update'));
    expect(queryByRole(container, 'alert')).toBeNull();
  });

  it('requires a reason before switching flows and applies the returned flow', async () => {
    const { user } = await renderPane();
    await user.click(getByRole(container, 'button', { name: 'Switch flow' }));
    let dialog = getByRole(document.body, 'dialog', { name: 'Switch flow' });
    await expectAccessible(document.body);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(queryByRole(document.body, 'dialog', { name: 'Switch flow' })).toBeNull();

    await user.click(getByRole(container, 'button', { name: 'Switch flow' }));
    dialog = getByRole(document.body, 'dialog', { name: 'Switch flow' });
    await waitFor(() => expect(mocks.getFlows).toHaveBeenCalled());
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Flow' }).querySelector('option[value="3"]')).toBeTruthy());
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Flow' }), '3');
    const submit = within(dialog).getByRole('button', { name: 'Switch flow' });

    expect(mocks.getFlows).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(true);
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason for switching (required)' }), 'Use the article process');
    await user.click(submit);

    await waitFor(() => expect(mocks.switchFlow).toHaveBeenCalledWith('new', 99907851, {
      flow_id: 3, reason: 'Use the article process',
    }));
    await waitFor(() => expect(getByText(container, 'Article · version 2')).toBeTruthy());
  });

  it('shows a finished state, reopens completed items, and displays flow history', async () => {
    mocks.getItemFlow.mockResolvedValueOnce(flowState({
      current_step: null,
      finished: { finish_state: 'unavailable', reason: 'Not available from suppliers' },
    }));
    const onReopen = vi.fn();
    const { container: pane, user } = await renderPane({ item: { ...item, status: 'complete' }, onReopen });

    await waitFor(() => expect(getByText(pane, 'Finished: Unavailable')).toBeTruthy());
    expect(pane.textContent).toContain('Not available from suppliers');
    expect(queryByRole(pane, 'button', { name: 'Yes' })).toBeNull();
    await user.click(getByRole(pane, 'button', { name: 'Reopen for Processing' }));
    expect(onReopen).toHaveBeenCalledWith(item.id);
    await expectAccessible(pane);
    await user.click(getByRole(pane, 'tab', { name: 'History' }));
    await waitFor(() => expect(getByText(pane, /Synthetic flow note/)).toBeTruthy());
    await waitFor(() => expect(getByRole(pane, 'heading', { name: 'Item flow history' })).toBeTruthy());
    expect(getByText(pane, /Synthetic flow note/)).toBeTruthy();
    expect(getByRole(pane, 'heading', { name: 'Item timeline: Synthetic item' })).toBeTruthy();
    await waitFor(() => expect(mocks.getItemTimeline).toHaveBeenCalledWith('new', 99907851));
    expect(getByText(pane, 'claimed')).toBeTruthy();

    await user.click(getByRole(pane, 'tab', { name: 'Process' }));
    mocks.getItemFlow.mockResolvedValueOnce(flowState({ flow: null, current_step: null, history: [] }));
    await user.click(getByRole(pane, 'button', { name: 'Reload item flow' }));
    await waitFor(() => expect(getByText(pane, 'No flow is set for this material type.')).toBeTruthy());
    expect(getByRole(pane, 'button', { name: 'Switch flow' })).toBeTruthy();
  });

  it('shows a not-started line and a flow-selection action', async () => {
    mocks.getItemFlow.mockResolvedValueOnce(flowState({ current_step: null, history: [] }));
    const { container: pane } = await renderPane();

    await waitFor(() => expect(pane.textContent).toContain('Not started. Select a flow to begin processing.'));
    expect(getByRole(pane, 'button', { name: 'Switch flow' })).toBeTruthy();
  });

  it('keeps processing handoff blocked until the item is ready', async () => {
    const onGoToWork = vi.fn();
    const blocked = { ...item, processingContext: { canOpenProcessing: false, blockingReason: 'Waiting for FOLIO confirmation.' } };
    const { container: pane, user } = await renderPane({ item: blocked, onGoToWork });

    expect(getByText(pane, 'Waiting for FOLIO confirmation.')).toBeTruthy();
    expect(queryByRole(pane, 'button', { name: 'Work on This' })).toBeNull();
    expect(onGoToWork).not.toHaveBeenCalled();

    await user.click(getByRole(pane, 'tab', { name: 'History' }));
    await user.click(getByRole(pane, 'tab', { name: 'Process' }));
  });

  it('opens processing when the item is claimed by the current staff member and ready', async () => {
    const onGoToWork = vi.fn();
    const { user } = await renderPane({ onGoToWork });

    await user.click(getByRole(container, 'button', { name: 'Work on This' }));

    expect(onGoToWork).toHaveBeenCalledWith(item);
  });

  it('shows the current assignee when someone else holds the claim', async () => {
    const { container: pane } = await renderPane({ item: { ...item, claimed_by: 'test-api078-owner' } });

    expect(getByText(pane, 'Being handled by Test Owner.')).toBeTruthy();
    expect(queryByRole(pane, 'button', { name: 'Work on This' })).toBeNull();
  });
});

describe('ItemWorkPane messages and details', () => {
  it('shows unread count, item messages, reply, and new-message actions', async () => {
    const { user } = await renderPane();
    const messagesTab = getByRole(container, 'tab', { name: 'Messages (1 unread)' });
    await user.click(messagesTab);

    expect(getByText(container, 'Please have this ready before classes begin.')).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'Reply to Reserve timing' })).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'New Staff Message' })).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'Message Faculty' })).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'Quick Note' })).toBeTruthy();
    await expectAccessible(container);

    await user.click(getByRole(container, 'button', { name: 'Reply to Reserve timing' }));
    expect(getByRole(document.body, 'heading', { name: 'Reply to Message' })).toBeTruthy();
  });

  it('opens the existing staff message composer from Messages', async () => {
    const { user } = await renderPane();
    await user.click(getByRole(container, 'tab', { name: 'Messages (1 unread)' }));
    await user.click(getByRole(container, 'button', { name: 'New Staff Message' }));

    expect(getByRole(document.body, 'heading', { name: 'Staff Message - Synthetic item' })).toBeTruthy();
  });

  it.each([
    ['Message Faculty', 'Message Faculty - Synthetic item'],
    ['Quick Note', 'Quick Note - Synthetic item'],
  ])('opens the existing %s action from Messages', async (action, heading) => {
    const { user } = await renderPane();
    await user.click(getByRole(container, 'tab', { name: 'Messages (1 unread)' }));
    await user.click(getByRole(container, 'button', { name: action }));

    expect(getByRole(document.body, 'heading', { name: heading })).toBeTruthy();
  });

  it('renders item metadata and both notes as a definition list', async () => {
    const { container: pane, user } = await renderPane();
    await user.click(getByRole(pane, 'tab', { name: 'Details' }));

    expect(getByText(pane, 'Author').nextElementSibling.textContent).toBe('Synthetic Author');
    expect(getByText(pane, 'Publication year').nextElementSibling.textContent).toBe('2026');
    expect(getByText(pane, 'Use the first chapter.')).toBeTruthy();
    expect(getByText(pane, 'Check the reserve shelf.')).toBeTruthy();
    expect(getByText(pane, '10.1000/aw059')).toBeTruthy();
    expect(getByText(pane, '1234-5678')).toBeTruthy();
    expect(getByText(pane, 'Synthetic Journal')).toBeTruthy();
    expect(getByText(pane, 'book')).toBeTruthy();
    expect(getByText(pane, '12')).toBeTruthy();
    expect(getByText(pane, '3')).toBeTruthy();
    expect(getByRole(pane, 'link', { name: 'View full record' }).getAttribute('href')).toBe('https://search.ebscohost.com/record/synthetic-aw059');
    await expectAccessible(pane);
  });

  it.each(['javascript:alert(1)', 'ftp://example.edu/record', '/relative/record'])(
    'omits the full-record link for unsafe EDS URL %s', async (plink) => {
      const { container: pane } = await renderPane({ item: { ...item, eds: { plink } } });

      expect(queryByRole(pane, 'link', { name: 'View full record' })).toBeNull();
    },
  );

  it('keeps every tab accessible', async () => {
    const { container: pane, user } = await renderPane();
    await expectAccessible(pane);

    for (const tabName of ['Messages (1 unread)', 'Details', 'History']) {
      await user.click(getByRole(pane, 'tab', { name: tabName }));
      await expectAccessible(pane);
    }
  });
});

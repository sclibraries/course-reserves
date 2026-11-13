import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAllGroups: vi.fn(), createGroup: vi.fn(), updateGroup: vi.fn(), deleteGroup: vi.fn(),
  getMembers: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), getStaff: vi.fn(),
}));
const notifications = vi.hoisted(() => {
  const toast = { id: 'synthetic-toast' };
  const notify = Object.fromEntries(['success', 'info', 'warning', 'error', 'fromError']
    .map((method) => [method, vi.fn(() => toast)]));
  return { toast, notify, toUserError: vi.fn(() => toast) };
});

vi.mock('../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));
vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));
vi.mock('../../../../services/notify', () => ({ notify: notifications.notify, toUserError: notifications.toUserError }));

import AdminGroups from './AdminGroups';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const group = { id: 7, name: 'Synthetic acquisitions', description: 'Books and orders' };
const member = { username: 'test-api078-owner', display_name: 'Test Owner' };

let root;
let container;

async function renderAdminGroups() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<AdminGroups />));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAllGroups.mockReset().mockResolvedValue({ groups: [group] });
  mocks.createGroup.mockReset().mockResolvedValue({ group });
  mocks.updateGroup.mockReset().mockResolvedValue({ group });
  mocks.deleteGroup.mockReset().mockResolvedValue({});
  mocks.getMembers.mockReset().mockResolvedValue({ members: [member] });
  mocks.addMember.mockReset().mockResolvedValue({ member: { username: 'test-api078-handler', display_name: 'Test Handler' } });
  mocks.removeMember.mockReset().mockResolvedValue({});
  mocks.getStaff.mockReset().mockResolvedValue({ items: [{ username: 'test-api078-handler', display_name: 'Test Handler' }] });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('AdminGroups', () => {
  it('creates a group and edits its name and description', async () => {
    await renderAdminGroups();
    const name = container.querySelector('input[name="new-group-name"]');
    const description = container.querySelector('textarea[name="new-group-description"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Synthetic media');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(description, 'Digital materials');
      description.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector('button[type="submit"][data-action="create-group"]').click());

    expect(mocks.createGroup).toHaveBeenCalledWith({ name: 'Synthetic media', description: 'Digital materials' });
    expect(container.querySelector('input[name="name-7"]').value).toBe('Synthetic acquisitions');

    const editName = container.querySelector('input[name="name-7"]');
    const editDescription = container.querySelector('textarea[name="description-7"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(editName, 'Synthetic reserves');
      editName.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editDescription, 'Course materials');
      editDescription.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector('button[type="submit"][data-action="update-group"]').click());

    expect(mocks.updateGroup).toHaveBeenCalledWith(7, { name: 'Synthetic reserves', description: 'Course materials' });
  });

  it.each([
    ['add', 'Added Test Handler to Synthetic acquisitions'],
    ['remove', 'Removed Test Owner from Synthetic acquisitions'],
  ])('shows the named success toast when members %s', async (action, successMessage) => {
    await renderAdminGroups();
    await act(async () => container.querySelector('button[aria-label="Manage members of Synthetic acquisitions"]').click());

    expect(mocks.getMembers).toHaveBeenCalledWith(7);
    expect(mocks.getStaff).toHaveBeenCalledWith('');
    expect(container.textContent).toContain('Test Owner');
    if (action === 'add') {
      const staffPicker = container.querySelector('select[name="add-member-username"]');
      await act(async () => {
        staffPicker.value = 'test-api078-handler';
        staffPicker.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await act(async () => container.querySelector('button[data-action="add-member"]').click());
      expect(mocks.addMember).toHaveBeenCalledWith(7, 'test-api078-handler');

      mocks.deleteGroup.mockRejectedValueOnce({ payload: { error_code: 'group_has_items' } });
      await act(async () => container.querySelector('button[aria-label="Delete Synthetic acquisitions"]').click());
      expect(container.textContent).toContain('Move or finish its items first');
    } else {
      await act(async () => container.querySelector('button[aria-label="Remove Test Owner from Synthetic acquisitions"]').click());
      expect(mocks.removeMember).toHaveBeenCalledWith(7, 'test-api078-owner');
    }

    expect(notifications.notify.success).toHaveBeenCalledWith(successMessage);
  });
});

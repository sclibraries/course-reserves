import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getMyGroups: vi.fn(), getGroupQueue: vi.fn(), claimItem: vi.fn() }));

vi.mock('../../../../services/admin/staffGroupsApi', () => ({ staffGroupsApi: mocks }));
vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));

import MyGroups from './MyGroups';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = {
  kind: 'new', id: 99907811, submission_id: 54, position: 1, title: 'Synthetic group item',
  course_code: 'TST 101', section: '01', term_code: '2026FA', material_type: 'book',
};
const groups = [{ id: 7, name: 'Synthetic acquisitions', queue_count: 1 }];

let root;
let container;

async function renderMyGroups() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MyGroups />));
}

beforeEach(() => {
  mocks.getMyGroups.mockReset().mockResolvedValue({ groups });
  mocks.getGroupQueue.mockReset().mockResolvedValue({ items: [item], count: 1 });
  mocks.claimItem.mockReset().mockResolvedValue({ item });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('MyGroups', () => {
  it('lists groups with queue counts and opens the shared group queue', async () => {
    await renderMyGroups();

    expect(container.textContent).toContain('Synthetic acquisitions');
    expect(container.textContent).toContain('1 queued item');
    await act(async () => container.querySelector('button[aria-label="Open Synthetic acquisitions queue"]').click());

    expect(mocks.getGroupQueue).toHaveBeenCalledWith(7);
    expect(container.textContent).toContain('Synthetic group item');
    expect(container.querySelector('button[aria-label="Claim Synthetic group item"]')).not.toBeNull();
  });

  it('claims an item from a group queue and refreshes that queue', async () => {
    await renderMyGroups();
    await act(async () => container.querySelector('button[aria-label="Open Synthetic acquisitions queue"]').click());
    await act(async () => container.querySelector('button[aria-label="Claim Synthetic group item"]').click());

    expect(mocks.claimItem).toHaveBeenCalledWith('new', 99907811);
    expect(mocks.getGroupQueue).toHaveBeenCalledTimes(2);
  });

});

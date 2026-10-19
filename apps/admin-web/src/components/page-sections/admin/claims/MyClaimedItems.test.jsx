import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getMyItems: vi.fn(), releaseItem: vi.fn() }));

vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));

import MyClaimedItems from './MyClaimedItems';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const items = [
  { kind: 'new', id: 1, submission_id: 54, position: 1, title: 'Expires later', course_code: 'TST 101', term_code: '2026FA', material_type: 'book', expires_at: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString() },
  { kind: 'reuse', id: 2, submission_id: 55, position: 2, title: 'Expires soon', course_code: 'BIO 110', term_code: '2026FA', material_type: 'article', expires_at: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString() },
];

let root;
let container;

async function renderItems() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MyClaimedItems />));
}

beforeEach(() => {
  mocks.getMyItems.mockReset().mockResolvedValue({ items });
  mocks.releaseItem.mockReset().mockResolvedValue({ item: items[0] });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('MyClaimedItems', () => {
  it('sorts by soonest expiry and marks claims below twelve hours', async () => {
    await renderItems();

    expect(Array.from(container.querySelectorAll('[data-item-id]')).map((row) => row.dataset.itemId))
      .toEqual(['2', '1']);
    expect(container.textContent).toContain('Expires in 11 h');
    expect(container.querySelector('[data-item-id="2"] .claim-expiry-warning')).not.toBeNull();
    expect(container.textContent).toContain('Expires in 23 h');
  });

  it('releases a claimed item and reloads My items', async () => {
    await renderItems();

    await act(async () => container.querySelector('button[aria-label="Release Expires later"]').click());

    expect(mocks.releaseItem).toHaveBeenCalledWith('new', 1);
    expect(mocks.getMyItems).toHaveBeenCalledTimes(2);
  });
});

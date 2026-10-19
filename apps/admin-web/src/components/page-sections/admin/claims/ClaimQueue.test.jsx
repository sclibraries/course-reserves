import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getQueue: vi.fn(), claimItem: vi.fn() }));

vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));

import ClaimQueue from './ClaimQueue';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const items = [
  { kind: 'new', id: 3, submission_id: 55, position: 1, title: 'Later submission', course_code: 'BIO 110', term_code: '2026FA', material_type: 'book' },
  { kind: 'reuse', id: 2, submission_id: 54, position: 2, title: 'Second item', course_code: 'TST 101', term_code: '2026FA', material_type: 'article' },
  { kind: 'new', id: 1, submission_id: 54, position: 1, title: 'First item', course_code: 'TST 101', term_code: '2026FA', material_type: 'article' },
];

let root;
let container;

async function renderQueue() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ClaimQueue />));
}

beforeEach(() => {
  mocks.getQueue.mockReset().mockResolvedValue({ items, count: items.length });
  mocks.claimItem.mockReset().mockResolvedValue({ item: items[0] });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('ClaimQueue', () => {
  it('renders queue items by oldest submission and faculty position', async () => {
    await renderQueue();

    expect(Array.from(container.querySelectorAll('[data-item-id]')).map((row) => row.dataset.itemId))
      .toEqual(['1', '2', '3']);
    expect(container.textContent).toContain('3 unclaimed items');
  });

  it('applies term and type filters to the queue request', async () => {
    await renderQueue();
    const term = container.querySelector('input[name="term"]');
    const type = container.querySelector('input[name="type"]');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(term, '2026FA');
      term.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(type, 'article');
      type.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector('button[type="submit"]').click());

    expect(mocks.getQueue).toHaveBeenLastCalledWith({ term: '2026FA', type: 'article', page: 1 });
  });

  it('shows a claim conflict and refreshes the queue row', async () => {
    mocks.getQueue
      .mockResolvedValueOnce({ items: [items[0]], count: 1 })
      .mockResolvedValueOnce({ items: [], count: 0 });
    mocks.claimItem.mockRejectedValueOnce({
      payload: { error_code: 'already_claimed', claimed_by_display: 'Test Staff' },
    });
    await renderQueue();

    await act(async () => container.querySelector('button[aria-label="Claim Later submission"]').click());

    expect(container.textContent).toContain('Already claimed by Test Staff.');
    expect(mocks.getQueue).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-item-id="3"]')).toBeNull();
  });

  it('leaves a visible My groups slot for AW-051', async () => {
    await renderQueue();

    expect(container.textContent).toContain('My groups');
  });
});

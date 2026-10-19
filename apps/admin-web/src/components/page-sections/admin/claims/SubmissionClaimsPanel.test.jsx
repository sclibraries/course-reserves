import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ claimAllItems: vi.fn() }));

vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({ claimsApi: mocks }));

import SubmissionClaimsPanel from './SubmissionClaimsPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const submission = { id: 54, uuid: 'synthetic-api078-submission', courseCode: 'TST 101', section: '01', term: '2026FA' };
const items = [
  { kind: 'reuse', id: 99907812, submission_id: 54, position: 2, title: 'Second item', material_type: 'book', claimed_by: null },
  { kind: 'new', id: 99907811, submission_id: 54, position: 1, title: 'First item', material_type: 'article', claimed_by: null },
];

let root;
let container;
const onChanged = vi.fn();

async function renderPanel() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <SubmissionClaimsPanel submission={submission} items={items} currentUsername="test-api078-staff" onChanged={onChanged} />,
  ));
}

beforeEach(() => {
  mocks.claimAllItems.mockReset().mockResolvedValue({
    claimed: [{ kind: 'new', id: 99907811 }],
    skipped: [{ kind: 'reuse', id: 99907812, claimed_by_display: 'Test Owner' }],
  });
  onChanged.mockReset();
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('SubmissionClaimsPanel', () => {
  it('shows claims in faculty order with each item claim state', async () => {
    await renderPanel();

    expect(Array.from(container.querySelectorAll('[data-item-id]')).map((row) => row.dataset.itemId))
      .toEqual(['99907811', '99907812']);
    expect(container.textContent).toContain('Unclaimed');
    expect(container.textContent).toContain('Claim all items');
  });

  it('shows the claimed and skipped result from claim all', async () => {
    await renderPanel();
    await act(async () => container.querySelector('button[aria-label="Claim all items"]').click());

    expect(mocks.claimAllItems).toHaveBeenCalledWith('synthetic-api078-submission');
    expect(container.textContent).toContain('Claimed 1 item');
    expect(container.textContent).toContain('Skipped 1 item');
    expect(container.textContent).toContain('Test Owner');
    expect(onChanged).toHaveBeenCalled();
  });
});

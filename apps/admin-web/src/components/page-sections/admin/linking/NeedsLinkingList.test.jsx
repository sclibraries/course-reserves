import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getNeedsLinking: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../../../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: { getNeedsLinking: mocks.getNeedsLinking },
}));

import NeedsLinkingList from './NeedsLinkingList';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const rows = [
  {
    submission_id: 31, submission_uuid: 'newer', faculty_display_name: 'Faculty Newer', course_code: 'BIO 110',
    section: '02', term_code: '2026FA', its_course_id: 'BIO-110-02-2026FA',
    submitted_at: '2026-10-15T12:00:00Z', waiting_hours: 24, suggestion: 'possible',
    checked_at: '2026-10-16T12:00:00Z',
  },
  {
    submission_id: 30, submission_uuid: 'oldest', faculty_display_name: 'Faculty Oldest', course_code: 'AFR 155',
    section: '01', term_code: '2026FA', its_course_id: 'AFR-155-01-2026FA',
    submitted_at: '2026-10-12T12:00:00Z', waiting_hours: 96, suggestion: 'exact',
    checked_at: null,
  },
  {
    submission_id: 32, submission_uuid: 'not-found', faculty_display_name: 'Faculty Not Found', course_code: 'TST 101',
    section: '01', term_code: '2027SP', its_course_id: 'TST-101-01-2027SP',
    submitted_at: '2026-10-14T12:00:00Z', waiting_hours: 48, suggestion: 'none',
    checked_at: '2026-10-16T10:00:00Z',
  },
];

let root;
let container;

async function renderList() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<NeedsLinkingList />);
  });
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.getNeedsLinking.mockReset().mockResolvedValue({ items: rows, count: rows.length });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('NeedsLinkingList', () => {
  it('sorts oldest first and shows the required course, wait, suggestion, and check details', async () => {
    await renderList();
    const rowButtons = Array.from(container.querySelectorAll('[data-submission-uuid]'));

    expect(rowButtons.map((row) => row.dataset.submissionUuid)).toEqual(['oldest', 'not-found', 'newer']);
    expect(container.textContent).toContain('Faculty Oldest');
    expect(container.textContent).toContain('AFR 155');
    expect(container.textContent).toContain('01');
    expect(container.textContent).toContain('2026FA');
    expect(container.textContent).toContain('4 days waiting');
    expect(container.textContent).toContain('Exact match');
    expect(container.textContent).toContain('Possible match');
    expect(container.textContent).toContain('Not in FOLIO yet');
    expect(container.textContent).toContain('Not checked');
    expect(container.textContent).toContain('Last checked');
  });

  it('opens the selected submission from the row', async () => {
    await renderList();
    const oldest = container.querySelector('[data-submission-uuid="oldest"]');

    await act(async () => oldest.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(mocks.navigate).toHaveBeenCalledWith('/admin/submissions/30');
  });

  it('does not make a row clickable when its numeric submission id is missing', async () => {
    mocks.getNeedsLinking.mockResolvedValueOnce({
      items: [{ ...rows[1], submission_id: undefined }],
      count: 1,
    });
    await renderList();
    const row = container.querySelector('[data-submission-uuid="oldest"]');

    expect(row.getAttribute('role')).toBeNull();
    expect(row.getAttribute('tabindex')).toBeNull();
    expect(row.textContent).toContain('Faculty Oldest');

    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows a visible error when the authenticated request fails', async () => {
    mocks.getNeedsLinking.mockRejectedValueOnce(new Error('Network offline'));
    await renderList();

    expect(container.textContent).toContain('Network offline');
  });

  it('does not render a draft returned unexpectedly by the needs-linking response', async () => {
    const draft = { ...rows[0], submission_id: 99907801, submission_uuid: 'synthetic-api078-draft', status: 'draft' };
    mocks.getNeedsLinking.mockResolvedValueOnce({ items: [draft], count: 1 });

    await renderList();

    expect(container.querySelector('[data-submission-uuid="synthetic-api078-draft"]')).toBeNull();
    expect(container.textContent).not.toContain('Faculty Newer');
  });
});

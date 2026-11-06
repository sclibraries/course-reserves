import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getByRole } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  createCommunication: vi.fn(),
  notify: { error: vi.fn(), fromError: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../services/notify', () => ({ notify: mocks.notify }));
vi.mock('../../../services/admin/submissionWorkflowService', () => ({
  submissionWorkflowService: { createCommunication: mocks.createCommunication },
}));

import QuickNoteModal from './QuickNoteModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

const item = {
  id: 991,
  submission_id: 742,
  title: 'Synthetic course reading',
  submission: { course_code: 'TST 101' },
};

let root;
let container;

async function renderModal() {
  const user = userEvent.setup();
  const toggle = vi.fn();
  const onNoteSaved = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <QuickNoteModal isOpen toggle={toggle} item={item} onNoteSaved={onNoteSaved} />,
  ));
  return { user, toggle, onNoteSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createCommunication.mockResolvedValue({});
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('QuickNoteModal', () => {
  it('saves the staff-only note and reports success', async () => {
    const { user, toggle, onNoteSaved } = await renderModal();
    await act(async () => {
      await user.type(getByRole(document.body, 'textbox', { name: /Note/ }), 'Check the synthetic edition.');
      await user.click(getByRole(document.body, 'button', { name: 'Save Note' }));
    });

    expect(mocks.createCommunication).toHaveBeenCalledWith(742, {
      message: 'Check the synthetic edition.',
      category: 'note',
      communication_type: 'internal_note',
      priority: 'normal',
      visibility: 'staff_only',
      resource_id: 991,
    });
    expect(mocks.notify.success).toHaveBeenCalledWith('Note saved');
    expect(onNoteSaved).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('reports an empty note without calling the service', async () => {
    await renderModal();
    await act(async () => fireEvent.submit(document.body.querySelector('form')));

    expect(mocks.notify.error).toHaveBeenCalledWith('Please enter a note');
    expect(mocks.createCommunication).not.toHaveBeenCalled();
  });

  it('has no axe violations while open', async () => {
    await renderModal();

    expect(await axe(document.body)).toHaveNoViolations();
  });
});

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

import FacultyMessageModal from './FacultyMessageModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

const item = {
  id: 991,
  submission_id: 742,
  title: 'Synthetic course reading',
  submission: {
    faculty_display_name: 'Synthetic Faculty',
    faculty_email: 'faculty@example.edu',
    course_code: 'TST 101',
    course_title: 'Synthetic Course',
  },
};

let root;
let container;

async function renderModal() {
  const user = userEvent.setup();
  const toggle = vi.fn();
  const onMessageSent = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <FacultyMessageModal isOpen toggle={toggle} item={item} onMessageSent={onMessageSent} />,
  ));
  return { user, toggle, onMessageSent };
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

describe('FacultyMessageModal', () => {
  it('sends the faculty-visible message and reports success', async () => {
    const { user, toggle, onMessageSent } = await renderModal();
    await act(async () => {
      await user.type(getByRole(document.body, 'textbox', { name: 'Subject *' }), 'Synthetic update');
      await user.type(getByRole(document.body, 'textbox', { name: 'Message *' }), 'The synthetic item is ready.');
      await user.click(getByRole(document.body, 'button', { name: 'Send to Faculty' }));
    });

    expect(mocks.createCommunication).toHaveBeenCalledWith(742, {
      message: 'The synthetic item is ready.',
      subject: 'Synthetic update',
      category: 'update',
      priority: 'normal',
      visibility: 'faculty_visible',
      resource_id: 991,
    });
    expect(mocks.notify.success).toHaveBeenCalledWith('Message sent to faculty');
    expect(onMessageSent).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('reports an empty message without calling the service', async () => {
    await renderModal();
    await act(async () => fireEvent.submit(document.body.querySelector('form')));

    expect(mocks.notify.error).toHaveBeenCalledWith('Please enter a message');
    expect(mocks.createCommunication).not.toHaveBeenCalled();
  });

  it('has no axe violations while open', async () => {
    await renderModal();

    expect(await axe(document.body)).toHaveNoViolations();
  });
});

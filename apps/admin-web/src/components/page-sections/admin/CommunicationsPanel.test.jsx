import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommunicationsPanel from './CommunicationsPanel';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CommunicationsPanel task due dates', () => {
  it('shows a SQL DATE task due date on its local calendar day', async () => {
    vi.spyOn(submissionWorkflowService, 'getSubmissionCommunications').mockResolvedValue([{
      id: 37,
      sender_name: 'Staff Reviewer',
      sender_type: 'staff',
      communication_type: 'staff_to_staff',
      visibility: 'staff_only',
      category: 'task',
      priority: 'normal',
      is_task: true,
      task_assignee: 'Staff Reviewer',
      task_due_date: '2026-12-18',
      created_at: '2026-10-14 12:00:00',
      message: 'Review the reserve request',
      replies: [],
    }]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const container = document.createElement('div');
    const root = createRoot(container);
    const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.appendChild(container);

    try {
      await act(async () => {
        root.render(createElement(CommunicationsPanel, { submissionId: '37' }));
      });

      expect(container.textContent).toContain('Due: 12/18/2026');
    } finally {
      await act(async () => root.unmount());
      document.body.removeChild(container);
      if (previousActEnvironment === undefined) {
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      } else {
        globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});

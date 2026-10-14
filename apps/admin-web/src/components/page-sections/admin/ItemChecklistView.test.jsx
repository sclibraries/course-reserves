import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ItemChecklistView from './ItemChecklistView';

const mocks = vi.hoisted(() => ({
  checklistService: {
    getItemChecklist: vi.fn(),
    listTemplates: vi.fn(),
    assignChecklistToItem: vi.fn(),
    updateTaskStatus: vi.fn(),
    completeItemChecklist: vi.fn(),
  },
  user: { username: 'test-staff' },
}));

vi.mock('../../../services/admin/checklistService', () => ({
  checklistService: mocks.checklistService,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const checklist = {
  template_id: 41,
  template_name: 'test-Checklist',
  description: 'test checklist description',
  tasks: [
    { id: 1, label: 'test-Required task', optional: false, completed: false },
    { id: 2, label: 'test-Optional task', optional: true, completed: false },
  ],
};

const templates = [
  {
    id: 51,
    name: 'test-Print checklist',
    description: 'test paper workflow',
    format: 'Print',
    material_types: ['Book'],
    task_count: 2,
  },
  {
    id: 52,
    name: 'test-Digital checklist',
    description: 'test online workflow',
    format: 'Digital',
    material_types: ['E-book'],
    task_count: 1,
  },
];

const mounted = new Set();

const renderComponent = async (props = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const view = {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
      mounted.delete(view);
    },
  };
  mounted.add(view);

  await act(async () => {
    root.render(createElement(ItemChecklistView, { itemId: 88, ...props }));
  });

  return view;
};

const click = async (element) => {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const changeValue = async (element, value) => {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  const eventType = element instanceof HTMLSelectElement ? 'change' : 'input';
  await act(async () => element.dispatchEvent(new Event(eventType, { bubbles: true })));
};

const toggleCheckbox = async (checkbox) => {
  await act(async () => checkbox.click());
};

const findButton = (container, text) =>
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes(text));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { username: 'test-staff' };
  mocks.checklistService.getItemChecklist.mockResolvedValue(checklist);
  mocks.checklistService.listTemplates.mockResolvedValue(templates);
  mocks.checklistService.assignChecklistToItem.mockResolvedValue({});
  mocks.checklistService.updateTaskStatus.mockResolvedValue({});
  mocks.checklistService.completeItemChecklist.mockResolvedValue({});
});

afterEach(async () => {
  for (const view of Array.from(mounted)) await view.unmount();
  vi.restoreAllMocks();
});

describe('ItemChecklistView characterization', () => {
  it('shows the loading state before rendering the loaded checklist', async () => {
    let resolveChecklist;
    mocks.checklistService.getItemChecklist.mockReturnValueOnce(new Promise((resolve) => {
      resolveChecklist = resolve;
    }));
    const view = await renderComponent();

    expect(view.container.textContent).toContain('Loading checklist...');

    await act(async () => resolveChecklist(checklist));
    expect(view.container.textContent).toContain('test-Checklist');
    expect(view.container.textContent).toContain('test-Required task');
    expect(view.container.textContent).toContain('0 of 2 tasks completed');
  });

  it('opens, filters, and assigns a template when no checklist is assigned', async () => {
    const noChecklist = Object.assign(new Error('No checklist assigned to this item'), { status: 404 });
    mocks.checklistService.getItemChecklist
      .mockRejectedValueOnce(noChecklist)
      .mockResolvedValueOnce(checklist);
    const view = await renderComponent();

    expect(view.container.textContent).toContain('No Checklist Assigned');
    await click(findButton(view.container, 'Assign Checklist'));
    const search = view.container.querySelector('input[placeholder="Search templates by name or description..."]');
    expect(view.container.textContent).toContain('test-Print checklist');
    expect(view.container.textContent).toContain('test-Digital checklist');

    await changeValue(search, 'digital');
    expect(view.container.textContent).toContain('test-Digital checklist');
    expect(view.container.textContent).not.toContain('test-Print checklist');

    await changeValue(search, '');
    const selects = view.container.querySelectorAll('select');
    await changeValue(selects[0], 'Print');
    expect(view.container.textContent).toContain('test-Print checklist');
    expect(view.container.textContent).not.toContain('test-Digital checklist');

    await changeValue(selects[0], 'all');
    await changeValue(selects[1], 'E-book');
    expect(view.container.textContent).toContain('test-Digital checklist');
    expect(view.container.textContent).not.toContain('test-Print checklist');

    await click(findButton(view.container, 'test-Digital checklist'));
    expect(mocks.checklistService.assignChecklistToItem).toHaveBeenCalledWith(88, 52, 'test-staff');
    expect(view.container.textContent).toContain('test-Checklist');
  });

  it('updates task status and progress when a task is toggled', async () => {
    const view = await renderComponent();
    const requiredTask = Array.from(view.container.querySelectorAll('label')).find((label) =>
      label.textContent.includes('test-Required task')
    );
    const checkbox = requiredTask.closest('.card').querySelector('input[type="checkbox"]');
    await toggleCheckbox(checkbox);

    expect(mocks.checklistService.updateTaskStatus).toHaveBeenCalledWith(88, 1, true, null, 'test-staff');
    expect(view.container.textContent).toContain('1 of 2 tasks completed');
    expect(view.container.textContent).toContain('50%');
  });

  it('saves edited task notes on blur', async () => {
    const view = await renderComponent();
    const notes = view.container.querySelector('textarea[placeholder="Optional notes..."]');
    await changeValue(notes, 'test-note text');
    expect(notes.value).toBe('test-note text');
    await act(async () => notes.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));

    expect(mocks.checklistService.updateTaskStatus).toHaveBeenCalledWith(88, 1, false, 'test-note text', 'test-staff');
  });

  it('reports required tasks remaining and completes after they are checked', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onComplete = vi.fn();
    const view = await renderComponent({ onComplete });

    expect(view.container.textContent).toContain('1 required task remaining');
    const completeButton = findButton(view.container, 'Mark Item as Complete');
    expect(completeButton.disabled).toBe(true);

    const requiredTask = Array.from(view.container.querySelectorAll('label')).find((label) =>
      label.textContent.includes('test-Required task')
    );
    const checkbox = requiredTask.closest('.card').querySelector('input[type="checkbox"]');
    await toggleCheckbox(checkbox);
    expect(view.container.textContent).not.toContain('1 required task remaining');
    expect(completeButton.disabled).toBe(false);

    await click(completeButton);
    expect(confirm).toHaveBeenCalledWith(
      'Are you sure you want to mark all remaining tasks as complete and finish this item?'
    );
    expect(mocks.checklistService.completeItemChecklist).toHaveBeenCalledWith(88, 'test-staff');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('shows the error state when loading the checklist fails', async () => {
    mocks.checklistService.getItemChecklist.mockRejectedValueOnce(new Error('test-service failure'));
    const view = await renderComponent();

    expect(view.container.textContent).toContain('Failed to load checklist. Please try again.');
    expect(findButton(view.container, 'Try Again')).toBeTruthy();
  });
});

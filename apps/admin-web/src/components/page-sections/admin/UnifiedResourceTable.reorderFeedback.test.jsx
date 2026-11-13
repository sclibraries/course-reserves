import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import UnifiedResourceTable from './UnifiedResourceTable';

const mocks = vi.hoisted(() => {
  const notify = {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    fromError: vi.fn(),
  };
  notify.fromError.mockImplementation((error, message) => notify.error(message, { reference: error.reference }));
  return { notify, toUserError: vi.fn(), onReorder: vi.fn() };
});

vi.mock('../../../services/notify', () => ({ notify: mocks.notify, toUserError: mocks.toUserError }));
vi.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, () => {}],
  useDrop: () => [null, () => {}],
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  vi.clearAllMocks();
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('UnifiedResourceTable reorder feedback', () => {
  it('shows one reorder error and keeps pending changes after a failed save', async () => {
    const error = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-ORDER-1' });
    mocks.onReorder.mockImplementation(async () => {
      mocks.notify.fromError(error, "Couldn't update the resource order");
      throw error;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(UnifiedResourceTable, {
      electronicResources: [
        { resource_id: 'one', course_resource_id: 101, name: 'Zebra', order: 1 },
        { resource_id: 'two', course_resource_id: 102, name: 'Alpaca', order: 2 },
      ],
      printResources: [],
      onReorder: mocks.onReorder,
    })));

    await act(async () => fireEvent.click(getByRole(container, 'button', { name: /Default Order/ })));
    await act(async () => fireEvent.click(getByText(container, 'Alphabetical (A-Z)')));
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Update Order' })));

    expect(mocks.onReorder).toHaveBeenCalledTimes(1);
    expect(mocks.notify.error).toHaveBeenCalledTimes(1);
    expect(mocks.notify.error).toHaveBeenCalledWith("Couldn't update the resource order", { reference: 'SYNTH-ORDER-1' });
    expect(getByRole(container, 'button', { name: 'Update Order' })).toBeTruthy();
  });
});

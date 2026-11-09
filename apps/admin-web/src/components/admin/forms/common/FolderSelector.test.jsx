import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByLabelText, getByRole, waitFor } from '@testing-library/dom';
import FolderSelector from './FolderSelector';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function renderSelector() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <FolderSelector selectedFolder="" handleFolderChange={vi.fn()} setFormData={vi.fn()} />
  ));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('FolderSelector errors', () => {
  it('announces a folder load failure and reports its reference', async () => {
    mocks.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ reference: 'SYNTH-FOLDER-LOAD-8' }),
    });
    await renderSelector();

    const alert = await waitFor(() => getByRole(container, 'alert'));
    const folder = getByRole(container, 'combobox', { name: 'Folder' });
    expect(alert.textContent).toContain('Failed to fetch folders');
    expect(folder.getAttribute('aria-describedby')).toBe(alert.id);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't load folders. Reference: SYNTH-FOLDER-LOAD-8",
      { closeButton: true, duration: Infinity },
    );
  });

  it('announces a folder create failure and reports its reference', async () => {
    mocks.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ reference_id: 'SYNTH-FOLDER-CREATE-9' }),
      });
    await renderSelector();

    const folder = await waitFor(() => getByRole(container, 'combobox', { name: 'Folder' }));
    await act(async () => fireEvent.change(folder, { target: { value: '__new__' } }));
    await act(async () => fireEvent.change(getByLabelText(container, 'New folder name'), {
      target: { value: 'Synthetic folder' },
    }));
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Add' })));

    const alert = await waitFor(() => getByRole(container, 'alert'));
    const name = getByLabelText(container, 'New folder name');
    expect(alert.textContent).toContain('Failed to create folder');
    expect(name.getAttribute('aria-describedby')).toBe(alert.id);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't create folder. Reference: SYNTH-FOLDER-CREATE-9",
      { closeButton: true, duration: Infinity },
    );
  });
});

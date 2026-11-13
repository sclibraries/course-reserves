import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmitDialog from './SubmitDialog';

const mocks = vi.hoisted(() => {
  const contextValue = {
    reserve: {
      courseCode: 'TST 101',
      term: 'Sandbox Term 2026',
      items: [{ id: 'item-1' }, { id: 'item-2' }],
      folders: [{ id: 'folder-1' }],
    },
    isEditingSubmission: false,
    isReadOnly: false,
    submitButtonRef: { current: null as HTMLButtonElement | null },
    submissionHandlers: { confirmSubmit: vi.fn() },
  };
  return { contextValue, contextModule: { useSubmissionEditorContext: () => contextValue } };
});

vi.mock('./SubmissionEditorContext', () => mocks.contextModule);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function DialogHarness({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button
        ref={(node) => { mocks.contextValue.submitButtonRef.current = node; }}
        type="button"
        onClick={() => setOpen(true)}
      >
        Submit to Library
      </button>
      <SubmitDialog
        showSubmitDialog={open}
        setShowSubmitDialog={setOpen}
        emailConfirmation={false}
        setEmailConfirmation={() => {}}
      />
    </>
  );
}

describe('SubmitDialog', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mocks.contextValue.submissionHandlers.confirmSubmit = vi.fn();
    mocks.contextValue.submitButtonRef.current = null;
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const render = (initiallyOpen = true) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<DialogHarness initiallyOpen={initiallyOpen} />));
  };

  const openDialog = () => {
    const opener = getByRole(document.body, 'button', { name: 'Submit to Library' });
    opener.focus();
    act(() => fireEvent.click(opener));
    return opener;
  };

  it('renders confirmation content without DOM nesting warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render();

    const domNestingWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0]).includes('validateDOMNesting')
    );

    expect(domNestingWarnings).toEqual([]);
  });

  it('disables Submit while pending and sends only one request', async () => {
    let finishSubmit!: (result: { success: boolean; message?: string }) => void;
    const submit = new Promise<{ success: boolean; message?: string }>((resolve) => { finishSubmit = resolve; });
    const confirmSubmit = vi.fn(() => submit);
    mocks.contextValue.submissionHandlers.confirmSubmit = confirmSubmit;
    render(false);
    openDialog();

    act(() => fireEvent.click(getByRole(document.body, 'button', { name: 'Submit' })));

    const pendingButton = getByRole(document.body, 'button', { name: 'Submitting...' }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    act(() => fireEvent.click(pendingButton));
    expect(confirmSubmit).toHaveBeenCalledTimes(1);

    await act(async () => { finishSubmit({ success: true }); await submit; });
    expect(queryByRole(document.body, 'alertdialog')).toBeNull();
  });

  it('keeps the dialog open with an inline alert after failure and restores focus on close', async () => {
    mocks.contextValue.submissionHandlers.confirmSubmit = vi.fn(async () => ({
      success: false,
      message: "Couldn't submit this reserve request",
    }));
    render(false);
    const opener = openDialog();

    await act(async () => {
      fireEvent.click(getByRole(document.body, 'button', { name: 'Submit' }));
      await Promise.resolve();
    });

    expect(getByRole(document.body, 'alertdialog')).toBeTruthy();
    expect(getByRole(document.body, 'alert').textContent).toBe("Couldn't submit this reserve request");
    act(() => fireEvent.click(getByRole(document.body, 'button', { name: 'Cancel' })));
    expect(queryByRole(document.body, 'alertdialog')).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('returns focus to the submit opener when Escape closes the dialog', () => {
    render(false);
    const opener = openDialog();

    act(() => fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' }));

    expect(queryByRole(document.body, 'alertdialog')).toBeNull();
    return vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

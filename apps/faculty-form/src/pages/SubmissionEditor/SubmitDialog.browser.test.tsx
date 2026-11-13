import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from './SubmissionEditorContext';
import SubmitDialog from './SubmitDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function DialogHarness({ confirmSubmit }: { confirmSubmit: () => Promise<{ success: boolean; message?: string }> }) {
  const [open, setOpen] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const context = {
    reserve: {
      id: 'reserve-synthetic', courseCode: 'TST 101', term: 'Fall 2026',
      items: [{ id: 'item-1' }], folders: [],
    },
    isEditingSubmission: false,
    isReadOnly: false,
    submissionHandlers: { confirmSubmit },
    submitButtonRef,
  } as unknown as SubmissionEditorContextValue;

  return (
    <>
      <button ref={submitButtonRef} type="button" onClick={() => setOpen(true)}>Submit to Library</button>
      <SubmissionEditorContext.Provider value={context}>
        <SubmitDialog
          showSubmitDialog={open}
          setShowSubmitDialog={setOpen}
          emailConfirmation={false}
          setEmailConfirmation={() => {}}
        />
      </SubmissionEditorContext.Provider>
    </>
  );
}

describe('SubmitDialog in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const render = async (confirmSubmit: () => Promise<{ success: boolean; message?: string }>) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<DialogHarness confirmSubmit={confirmSubmit} />));
    const opener = getByRole(document.body, 'button', { name: 'Submit to Library' });
    opener.focus();
    await act(async () => fireEvent.click(opener));
    return opener;
  };

  it('has no axe violations or overflow while submission is pending', async () => {
    let finishSubmit!: (result: { success: boolean }) => void;
    const submit = new Promise<{ success: boolean }>((resolve) => { finishSubmit = resolve; });
    const confirmSubmit = vi.fn(() => submit);
    await render(confirmSubmit);

    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Submit' })));

    const dialog = getByRole(document.body, 'alertdialog');
    expect(getByRole(dialog, 'button', { name: 'Submitting...' })).toBeTruthy();
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(dialog);

    await act(async () => { finishSubmit({ success: true }); await submit; });
  });

  it('has no axe violations or overflow after failure and returns focus on close', async () => {
    const confirmSubmit = vi.fn(async () => ({ success: false, message: "Couldn't submit this reserve request" }));
    const opener = await render(confirmSubmit);

    await act(async () => {
      fireEvent.click(getByRole(document.body, 'button', { name: 'Submit' }));
      await Promise.resolve();
    });

    const dialog = getByRole(document.body, 'alertdialog');
    expect(getByRole(dialog, 'alert').textContent).toBe("Couldn't submit this reserve request");
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(dialog);

    act(() => fireEvent.click(getByRole(dialog, 'button', { name: 'Cancel' })));
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

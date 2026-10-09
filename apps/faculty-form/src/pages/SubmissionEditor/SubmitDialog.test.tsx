import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SubmitDialog from './SubmitDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const contextValue = {
  reserve: {
    courseCode: 'TST 101',
    term: 'Sandbox Term 2026',
    items: [{ id: 'item-1' }, { id: 'item-2' }],
    folders: [{ id: 'folder-1' }],
  },
  isEditingSubmission: false,
  isReadOnly: false,
  submissionHandlers: {
    confirmSubmit: vi.fn(),
  },
};

vi.mock('./SubmissionEditorContext', () => ({
  useSubmissionEditorContext: () => contextValue,
}));

describe('SubmitDialog', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <SubmitDialog
          showSubmitDialog={true}
          setShowSubmitDialog={() => {}}
          emailConfirmation={false}
          setEmailConfirmation={() => {}}
        />
      );
    });
  };

  it('renders confirmation content without DOM nesting warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render();

    const domNestingWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0]).includes('validateDOMNesting')
    );

    expect(domNestingWarnings).toEqual([]);
  });
});

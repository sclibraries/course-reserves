import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from './SubmissionEditorContext';
import { expectNoHorizontalOverflow } from '@/test/browser';

const context = {
  reserve: { courseCode: 'TEST 101', term: 'Fall 2026' },
  id: 'test-reserve-101',
  isEditingSubmission: false,
  hasPreviousOffering: true,
  isReadOnly: false,
  saveDraft: () => {},
  isSaving: false,
  hasUnsavedChanges: false,
  lastSaveTime: null,
  saveError: null,
  submissionHandlers: { handleSubmit: () => {} },
} as SubmissionEditorContextValue;

describe('SubmissionEditor Header in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const renderHeader = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(
      <MemoryRouter>
        <SubmissionEditorContext.Provider value={context}>
          <Header />
        </SubmissionEditorContext.Provider>
      </MemoryRouter>,
    ));
    expect(container.textContent).toContain('Reuse last time’s list');
  };

  it('reflows the editor header at supported widths', async () => {
    await renderHeader();
    await expectNoHorizontalOverflow();
  });

  it('has no page overflow at tablet and desktop widths', async () => {
    await renderHeader();
    await expectNoHorizontalOverflow([768, 1280]);
  });
});

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const headerMocks = vi.hoisted(() => ({
  context: {
    reserve: { courseCode: 'BIO 026', term: 'Fall 2100' },
    id: 'reserve-026',
    isEditingSubmission: false,
    hasPreviousOffering: true,
    isReadOnly: false,
    saveDraft: vi.fn(),
    isSaving: false,
    hasUnsavedChanges: false,
    lastSaveTime: null,
    saveError: null,
    submissionHandlers: { handleSubmit: vi.fn() },
  },
}));

vi.mock('./SubmissionEditorContext', () => ({
  useSubmissionEditorContext: () => headerMocks.context,
}));

import Header from './Header';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}{location.search}</output>;
}

describe('SubmissionEditor Header reuse shortcut', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('opens Reuse with the previous same-number course selected', () => {
    act(() => root?.render(<MemoryRouter initialEntries={['/submission/reserve-026/edit']}><Header /><CurrentLocation /></MemoryRouter>));

    const reuseButton = Array.from(container!.querySelectorAll('button'))
      .find((button) => /reuse last time’s list/i.test(button.textContent || ''));
    act(() => reuseButton?.click());

    expect(container!.querySelector('[data-testid="current-location"]')?.textContent)
      .toBe('/submission/reserve-026/edit/add?tab=reuse&course=last');
  });
});

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';

const testStorage = vi.hoisted(() => {
  const values: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  };
  vi.stubGlobal('localStorage', localStorage);
  return { localStorage };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-router-dom', () => ({
  Navigate: () => null,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/submission/submission-1/edit', search: '', state: null }),
  useParams: () => ({ id: 'submission-1' }),
}));
vi.mock('@/hooks/usePreviousCourseDetection', () => ({ usePreviousCourseDetection: () => ({ hasExactMatchCourses: false }) }));
vi.mock('@/hooks/useUnsavedChangesWarning', () => ({ useUnsavedChangesWarning: () => {} }));
vi.mock('@/hooks/useContentOrganization', () => ({
  useOrganizedContent: () => ({ ungroupedItems: [], folders: [] }),
  useFilteredAndSortedContent: () => ({ ungroupedItems: [], folders: [] }),
}));
vi.mock('./Header', () => ({ default: () => null }));
vi.mock('./ActionBar', async () => {
  const { useSubmissionEditorContext } = await import('./SubmissionEditorContext');
  const ActionBarMock = () => {
    const editor = useSubmissionEditorContext();
    return <button onClick={() => editor.itemHandlers.handleSaveItem({
      title: 'Local edit', materialType: 'Book', author: '', citation: '', sourceLink: '',
      requestType: '', publicNote: '',
    })}>Add local edit</button>;
  };
  return {
    default: ActionBarMock,
  };
});
vi.mock('./ContentList', async () => {
  const { useSubmissionEditorContext } = await import('./SubmissionEditorContext');
  const ContentListMock = () => {
    const { reserve } = useSubmissionEditorContext();
    return <div>{reserve.items.map((item) => <span key={item.id}>{item.title}</span>)}</div>;
  };
  return {
    default: ContentListMock,
  };
});
vi.mock('./SubmitDialog', () => ({ default: () => null }));
vi.mock('@/components/ItemModal', () => ({ ItemModal: () => null }));
vi.mock('@/components/CourseModal', () => ({ CourseModal: () => null }));
vi.mock('@/components/Communications/CorrectionRequiredDialog', () => ({ default: () => null }));

import SubmissionEditor from './index';
import { useDraftStore } from '@/store/draftStore';
import { useReserveStore } from '@/store/useReserveStore';

describe('SubmissionEditor refetch after the draft autosave stub resolves', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchResponse: Record<string, unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [buildReserve()] });
    fetchResponse = buildResponse({ title: 'Server copy after refocus' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => fetchResponse }) as Response));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<SubmissionEditor />));
  });

  afterEach(() => {
    act(() => root.unmount());
    useDraftStore.getState().clearAllDrafts();
    useReserveStore.setState({ reserves: [] });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', testStorage.localStorage);
    container.remove();
    document.body.innerHTML = '';
  });

  it('keeps local edits after the stub autosave clears its draft-store flag', async () => {
    await addLocalEdit();
    expect(localItemTitles()).toContain('Local edit');
    await advancePastStubSave();
    expect(useDraftStore.getState().hasChanges('submission-1')).toBe(false);
    expect(localItemTitles()).toContain('Local edit');

    await refocus();

    expect(container.textContent).toContain('Local edit');
    expect(container.textContent).not.toContain('Server copy after refocus');
  });

  it('applies the server copy on refocus when there were no local edits', async () => {
    await refocus();

    expect(container.textContent).toContain('Server copy after refocus');
    expect(container.textContent).not.toContain('Original server title');
  });

  it('keeps edits visible and explains the lock after the stub autosave resolves', async () => {
    fetchResponse = buildResponse({ title: 'Locked server copy', locked: true });
    await addLocalEdit();
    expect(localItemTitles()).toContain('Local edit');
    await advancePastStubSave();
    expect(useDraftStore.getState().hasChanges('submission-1')).toBe(false);

    await refocus();

    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('Local edit');
    expect(container.textContent).toContain(
      'Your unsaved changes could not be saved because library staff are working on this submission.'
    );
  });

  async function addLocalEdit() {
    await act(async () => {
      const button = Array.from(container.querySelectorAll('button'))
        .find((candidate) => candidate.textContent === 'Add local edit');
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  function localItemTitles() {
    return useReserveStore.getState().getReserveById('submission-1')?.items.map((item) => item.title) ?? [];
  }

  async function advancePastStubSave() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
  }

  async function refocus() {
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
      await vi.waitFor(() => expect(useReserveStore.getState().getReserveById('submission-1')?.status)
        .toBe((fetchResponse.items as Array<{ status: string }>)[0].status));
    });
  }
});

function buildReserve(overrides: Partial<CourseReserve> = {}): CourseReserve {
  return {
    id: 'submission-1', courseCode: 'BIO 101', courseTitle: 'Biology', section: '01',
    instructors: 'Faculty One', term: '2026FA', status: 'submitted',
    items: [{ id: 'material-1', title: 'Original server title', materialType: 'book', status: 'draft' }],
    folders: [], lastUpdated: 'Jun 17, 2026', isLocked: false, canEdit: true,
    ...overrides,
  };
}

function buildResponse({ title, locked = false }: { title: string; locked?: boolean }) {
  return {
    items: [{
      submission_uuid: 'submission-1', course_code: 'BIO 101', course_title: 'Biology',
      section: '01', faculty_display_name: 'Faculty One', term_code: '2026FA',
      updated_at: '2026-06-18T12:00:00.000Z', status: locked ? 'in-progress' : 'submitted',
      is_locked: locked, can_edit: !locked, locked_by: locked ? 'Library staff' : undefined,
      folders: [],
      unfoldered_items: [{ id: 1, title, material_type: 'book', status: 'draft', display_order: 0 }],
    }],
  };
}


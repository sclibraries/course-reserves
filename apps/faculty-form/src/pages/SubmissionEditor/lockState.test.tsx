import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorUIStore } from '@/store/useEditorUIStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const lockedReserve = {
  id: 'sub-1', courseCode: 'ENG 101', courseTitle: 'Intro', section: '01',
  instructors: 'Prof', term: 'Fall 2026', status: 'submitted',
  items: [], folders: [], isLocked: true, canEdit: false,
  lockedBy: 'Jane Staff', lockedAt: '2026-06-20T10:00:00Z', lockReason: 'Processing',
};

const actingForMocks = vi.hoisted(() => ({
  selectedFaculty: null as { username: string; displayName: string } | null,
  canEdit: null as boolean | null,
  clearSelection: vi.fn(),
  clearActingForAssignments: vi.fn(),
  fetchCourseAssignments: vi.fn(),
}));

vi.mock('@/store/actingForStore', () => ({
  useActingForStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    selectedFaculty: actingForMocks.selectedFaculty,
    clearSelection: actingForMocks.clearSelection,
  }),
}));

vi.mock('@/store/courseAssignmentsStore', () => ({
  useCourseAssignmentsStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    actingForCanEdit: actingForMocks.canEdit,
    clearActingForAssignments: actingForMocks.clearActingForAssignments,
    fetchCourseAssignments: actingForMocks.fetchCourseAssignments,
  }),
}));

vi.mock('@/hooks/useSubmissionEditor', () => ({
  useSubmissionEditor: () => ({
    id: 'sub-1', reserve: lockedReserve, user: { full_name: 'Dr X' },
    modalOpen: false, setModalOpen: () => {}, editingItem: null, setEditingItem: () => {},
    showSubmitDialog: false, setShowSubmitDialog: () => {},
    emailConfirmation: false, setEmailConfirmation: () => {},
    courseModalOpen: false, setCourseModalOpen: () => {},
    sortBy: 'manual', setSortBy: () => {}, searchQuery: '', setSearchQuery: () => {},
    filters: {}, setFilters: () => {}, resetFilters: () => {}, hasActiveFiltersOrSort: false,
    addItem: () => {}, updateItem: () => {}, deleteItem: () => {}, reorderItems: () => {},
    moveItemToPosition: () => {}, updateReserve: () => {}, createFolder: () => {}, updateFolder: () => {},
    deleteFolder: () => {}, toggleFolder: () => {}, addItemToFolder: () => {}, removeItemFromFolder: () => {},
    moveItemInFolder: () => {}, moveFolderPosition: () => {},
  }),
}));
// Silence side-effect hooks and heavy dialogs not under test.
vi.mock('@/hooks/usePreviousCourseDetection', () => ({ usePreviousCourseDetection: () => {} }));
vi.mock('@/hooks/useCourseCloning', () => ({ useCourseCloning: () => ({ fetchPreviousCourses: vi.fn() }) }));
vi.mock('@/hooks/useUnsavedChangesWarning', () => ({ useUnsavedChangesWarning: () => {} }));
vi.mock('@/hooks/useContentOrganization', () => ({
  useOrganizedContent: () => ({ ungroupedItems: [], folders: [] }),
  useFilteredAndSortedContent: () => ({ ungroupedItems: [], folders: [] }),
}));
vi.mock('./ContentList', () => ({ default: () => null }));
vi.mock('./SubmitDialog', () => ({ default: () => null }));
vi.mock('./DuplicateDialog', () => ({ default: () => null }));
vi.mock('@/components/ItemModal', () => ({ ItemModal: () => null }));
vi.mock('@/components/CourseModal', () => ({ CourseModal: () => null }));
vi.mock('@/components/CloneDialog', () => ({ CloneDialog: () => null }));
vi.mock('@/components/DiscoverySearchDialog', () => ({ DiscoverySearchDialog: () => null }));
vi.mock('@/components/SyllabusUploadDialog', () => ({ SyllabusUploadDialog: () => null }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import SubmissionEditor from './index';

describe('SubmissionEditor lock state', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    useEditorUIStore.getState().closeCorrectionRequiredDialog();
    actingForMocks.selectedFaculty = null;
    actingForMocks.canEdit = null;
    actingForMocks.clearSelection.mockReset();
    actingForMocks.clearActingForAssignments.mockReset();
    actingForMocks.fetchCourseAssignments.mockReset().mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<SubmissionEditor />));
  });
  afterEach(() => {
    act(() => root?.unmount());
    useEditorUIStore.getState().closeCorrectionRequiredDialog();
    actingForMocks.selectedFaculty = null;
    container?.remove();
    container = null; root = null;
    document.body.innerHTML = '';
  });

  it('renders the lock banner when the reserve is locked', () => {
    expect(container!.textContent).toContain('locked for editing');
    expect(container!.textContent).toContain('Jane Staff');
  });

  it('disables the editing fieldset when read-only', () => {
    const fieldset = container!.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset!.disabled).toBe(true);
  });

  it('disables the Edit Course Info button when the submission is locked', () => {
    const buttons = Array.from(container!.querySelectorAll('button'));
    const editCourseBtn = buttons.find((b) => b.textContent?.includes('Edit Course Info'));
    expect(editCourseBtn).not.toBeUndefined();
    expect(editCourseBtn!.disabled).toBe(true);
  });

  it('orders the editor header, acting-for banner, and action bar inside one sticky region', () => {
    actingForMocks.selectedFaculty = { username: 'test-faculty', displayName: 'Test Faculty' };
    act(() => root!.render(<SubmissionEditor />));

    const stack = container!.querySelector('[data-testid="page-sticky-top"]');
    const banner = stack?.querySelector('[role="status"]');
    const header = stack?.querySelector('header');
    const actionBar = stack?.querySelector('[data-testid="submission-editor-action-bar"]');

    expect(stack).not.toBeNull();
    expect(stack?.classList.contains('sticky')).toBe(true);
    expect(stack?.classList.contains('top-0')).toBe(true);
    expect(header).not.toBeNull();
    expect(banner).not.toBeNull();
    expect(actionBar).not.toBeNull();
    expect(header?.classList.contains('sticky')).toBe(false);
    expect(actionBar?.classList.contains('sticky')).toBe(false);
    expect(Boolean(header!.compareDocumentPosition(actionBar!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(header!.compareDocumentPosition(banner!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(banner!.compareDocumentPosition(actionBar!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(banner?.classList.contains('sticky')).toBe(false);
  });

  it('omits the editor banner when no faculty member is selected', () => {
    act(() => root!.render(<SubmissionEditor />));

    expect(container!.querySelector('[data-testid="page-sticky-top"] [role="status"]')).toBeNull();
  });

  it('mounts the correction dialog in the editor and displays its store detail', () => {
    act(() => useEditorUIStore.getState().openCorrectionRequiredDialog({
      submissionUuid: 'sub-1',
      itemIds: [259],
      attemptedUpdate: { items: [{ item_uuid: '259', title: 'Climate and Society' }] },
    }));

    expect(document.body.textContent).toContain('must be corrected by library staff');
    expect(document.body.textContent).toContain('Climate and Society');
  });
});

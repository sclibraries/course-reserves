import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { notify } from '@/services/notify';
import { Button } from '@/components/ui/button';
import { useSubmissionEditor } from '@/hooks/useSubmissionEditor';
import { usePreviousCourseDetection } from '@/hooks/usePreviousCourseDetection';
import { useOrganizedContent, useFilteredContent } from '@/hooks/useContentOrganization';
import { useSubmissionEditorDrafts } from '@/hooks/useSubmissionEditorDrafts';
import { useSubmissionLock } from '@/hooks/useSubmissionLock';
import { hasLocalMaterialEdits } from '@/store/reserve/submissionRefetchMerge';
import { SubmissionLockBanner } from '@/components/SubmissionLockBanner';
import { useReserveStore } from '@/store/useReserveStore';
import { EMPTY_ADDED_MATERIALS, useAddedMaterialsVisitStore } from '@/store/addedMaterialsVisitStore';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import { createItemHandlers } from '@/handlers/itemHandlers';
import { createAddMaterialHandler } from '@/handlers/addMaterialHandler';
import { createFolderHandlers, createCourseHandlers } from '@/handlers/folderHandlers';
import { createDragHandlers } from '@/handlers/dragHandlers';
import { createSubmissionHandlers } from '@/handlers/submissionHandlers';
import { ItemModal } from '@/components/ItemModal';
import { CourseModal } from '@/components/CourseModal';
import CorrectionRequiredDialog from '@/components/Communications/CorrectionRequiredDialog';
import SubmissionEditorContext from './SubmissionEditorContext';
import StickyStack from './StickyStack';
import ContentList from './ContentList';
import SubmitDialog from './SubmitDialog';
import { DraftConflictNotice } from '@/components/SubmissionEditor/DraftConflictNotice';
import AddMaterialsPage from '../AddMaterials/AddMaterialsPage';
import CourseTitleRow from './CourseTitleRow';

const SubmissionEditor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAddMaterialsPage = location.pathname.includes('/edit/add');
  const {
    id, reserve, user,
    modalOpen, setModalOpen, editingItem, setEditingItem,
    showSubmitDialog, setShowSubmitDialog,
    emailConfirmation, setEmailConfirmation,
    courseModalOpen, setCourseModalOpen,
    searchQuery, setSearchQuery, isSearching,
    addItem, updateItem, deleteItem, moveTo, moveItemInList, updateReserve,
    createFolder, updateFolder, deleteFolder, toggleFolder,
    addItemToFolder, removeItemFromFolder, moveItemInFolder, moveFolderPosition,
  } = useSubmissionEditor();

  const firstName = user?.full_name?.split(' ')[0] || '';
  const previousCourseDetection = usePreviousCourseDetection(id, reserve?.courseCode, reserve?.items.length ?? 0, reserve?.folders.length ?? 0, firstName);


  const [hasRemoteItemsChanged, setHasRemoteItemsChanged] = React.useState(false);
  const serverReserveSnapshotRef = React.useRef<CourseReserve | undefined>(undefined);
  React.useEffect(() => {
    if (!serverReserveSnapshotRef.current && reserve) serverReserveSnapshotRef.current = reserve;
  }, [reserve]);
  const refetchSubmission = React.useCallback(() => {
    if (id) {
      void useReserveStore.getState().fetchSubmissionDetails(id, true, {
        previousServerReserve: serverReserveSnapshotRef.current,
        onServerReserveFetched: (serverReserve) => { serverReserveSnapshotRef.current = serverReserve; },
        onRemoteItemsChanged: setHasRemoteItemsChanged,
      });
    }
  }, [id]);
  const { isReadOnly, lockInfo } = useSubmissionLock(reserve, { onRefocus: refetchSubmission });

  const draftSync = useSubmissionEditorDrafts(id, reserve, !!user, isReadOnly, navigate);
  const {
    saveDraft, ensureServerUuid, markChanged, lastSaveTime, saveError, hasUnsavedChanges, isSaving,
    saveStatus, hasConflict, loadLatestVersion,
  } = draftSync;
  const addedMaterials = useAddedMaterialsVisitStore((state) => state.itemsByReserve[id || ''] || EMPTY_ADDED_MATERIALS);
  const undoAddedMaterial = (itemId: string) => {
    if (reserve?.items.some((item) => item.id === itemId)) {
      deleteItem(id!, itemId);
      markChanged();
    }
    if (id) useAddedMaterialsVisitStore.getState().remove(id, itemId);
  };
  const onAddedMaterial = (item: CourseItem) => {
    if (!isAddMaterialsPage || !id) return;
    useAddedMaterialsVisitStore.getState().add(id, { id: item.id, title: item.title });
    notify.success(`Added: ${item.title}`, {
      action: { label: 'Undo', onClick: () => undoAddedMaterial(item.id) },
    });
  };
  const requestedFolderId = new URLSearchParams(location.search).get('folder');
  const defaultFolderId = isAddMaterialsPage && reserve?.folders.some((folder) => folder.id === requestedFolderId)
    ? requestedFolderId || undefined
    : undefined;
  const wrappedAddItem = createAddMaterialHandler({
    reserveId: id || '',
    addItem,
    markChanged,
    defaultFolderId,
    onAdded: onAddedMaterial,
  });
  const hasLocalEdits = hasLocalMaterialEdits(reserve, serverReserveSnapshotRef.current);

  useUnsavedChangesWarning(true, hasUnsavedChanges);
  const organizedContent = useOrganizedContent(reserve);
  const filteredContent = useFilteredContent(organizedContent, searchQuery);

  if (!reserve) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Course Reserve Not Found</h1>
          <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (reserve.access === 'proxy' && reserve.proxyCanEdit === false) {
    return <Navigate to={`/submission/${id}`} replace />;
  }

  const wrappedUpdateItem = (...a: Parameters<typeof updateItem>) => { updateItem(...a); markChanged(); };
  const wrappedDeleteItem = (...a: Parameters<typeof deleteItem>) => { deleteItem(...a); markChanged(); };
  const wrappedUpdateReserve = (...a: Parameters<typeof updateReserve>) => { updateReserve(...a); markChanged(); };
  const wrappedCreateFolder = (...a: Parameters<typeof createFolder>) => { const r = createFolder(...a); markChanged(); return r; };
  const wrappedUpdateFolder = (...a: Parameters<typeof updateFolder>) => { updateFolder(...a); markChanged(); };
  const wrappedDeleteFolder = (...a: Parameters<typeof deleteFolder>) => { deleteFolder(...a); markChanged(); };
  const wrappedAddItemToFolder = (...a: Parameters<typeof addItemToFolder>) => { addItemToFolder(...a); markChanged(); };
  const wrappedMoveItemInList = (...a: Parameters<typeof moveItemInList>) => {
    const didMove = moveItemInList(...a);
    if (didMove) markChanged();
    return didMove;
  };
  const wrappedMoveTo = (...a: Parameters<typeof moveTo>) => { moveTo(...a); markChanged(); };

  const itemHandlers = createItemHandlers(id!, wrappedAddItem, wrappedUpdateItem, wrappedDeleteItem, wrappedMoveItemInList, wrappedUpdateReserve, isSearching, setEditingItem, setModalOpen);
  const folderHandlers = createFolderHandlers(id!, wrappedCreateFolder, wrappedUpdateFolder, wrappedDeleteFolder, toggleFolder);
  const courseHandlers = createCourseHandlers(id!, wrappedUpdateReserve, setCourseModalOpen);
  const dragHandlers = createDragHandlers(id!, wrappedMoveTo, isSearching);
  const submissionHandlers = createSubmissionHandlers(navigate, reserve, organizedContent, setShowSubmitDialog, draftSync);
  const ctxValue = {
    id: id!, reserve, isEditingSubmission: reserve.status === 'submitted',
    hasPreviousOffering: previousCourseDetection.hasExactMatchCourses,
    isReadOnly, lockInfo,
    saveDraft, ensureServerUuid, isSaving, hasUnsavedChanges, lastSaveTime, saveError,
    saveStatus,
    itemHandlers, folderHandlers, courseHandlers, dragHandlers, submissionHandlers,
    markChanged,
    removeItemFromFolder: (...a: Parameters<typeof removeItemFromFolder>) => { removeItemFromFolder(...a); markChanged(); },
    moveItemInFolder: (...a: Parameters<typeof moveItemInFolder>) => { moveItemInFolder(...a); markChanged(); },
    addItemToFolder: (...a: Parameters<typeof addItemToFolder>) => { addItemToFolder(...a); markChanged(); },
    moveFolderPosition: (...a: Parameters<typeof moveFolderPosition>) => { moveFolderPosition(...a); markChanged(); },
    user, addItem: wrappedAddItem, createFolder: wrappedCreateFolder,
    addedMaterials, undoAddedMaterial,
  };

  return (
    <SubmissionEditorContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-background">
        <StickyStack />
        {isAddMaterialsPage ? (
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {isReadOnly && lockInfo && (
              <div className="mb-6">
                <SubmissionLockBanner lockInfo={lockInfo} onRefresh={refetchSubmission} onBack={() => navigate(`/submission/${id}`)} />
              </div>
            )}
            <AddMaterialsPage />
          </main>
        ) : (
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CourseTitleRow
            courseCode={reserve.courseCode}
            courseTitle={reserve.courseTitle}
            section={reserve.section}
            term={reserve.term}
            isReadOnly={isReadOnly}
            onEditCourse={courseHandlers.handleEditCourse}
          />
          {hasRemoteItemsChanged && (
            <div role="status" className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              This submission was updated elsewhere. Your unsaved changes are kept.
            </div>
          )}
          <DraftConflictNotice visible={hasConflict} onLoadLatest={loadLatestVersion} />
          {isReadOnly && lockInfo && (
            <div className="mb-6">
              <SubmissionLockBanner lockInfo={lockInfo} onRefresh={refetchSubmission} onBack={() => navigate('/')} />
              {hasLocalEdits && (
                <p role="status" className="mt-3 text-sm text-amber-900">
                  Your unsaved changes could not be saved because library staff are working on this submission.
                </p>
              )}
            </div>
          )}
          <fieldset disabled={isReadOnly} className="space-y-6 border-0 p-0 m-0 min-w-0 disabled:opacity-70">
            <ContentList
              organizedContent={organizedContent}
              filteredContent={filteredContent}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSearching={isSearching}
            />
          </fieldset>
        </main>
        )}
        <ItemModal open={modalOpen} onOpenChange={setModalOpen} onSave={(data) => itemHandlers.handleSaveItem(data, editingItem)} initialData={editingItem} showSuccessToast={!isAddMaterialsPage} />
        <SubmitDialog showSubmitDialog={showSubmitDialog} setShowSubmitDialog={setShowSubmitDialog} emailConfirmation={emailConfirmation} setEmailConfirmation={setEmailConfirmation} />
        <CourseModal open={courseModalOpen} onOpenChange={setCourseModalOpen} onSave={courseHandlers.handleSaveCourse} initialData={{ courseCode: reserve.courseCode, courseTitle: reserve.courseTitle, section: reserve.section, instructors: reserve.instructors, term: reserve.term }} isEditing={true} />
        <CorrectionRequiredDialog />
      </div>
    </SubmissionEditorContext.Provider>
  );
};

export default SubmissionEditor;

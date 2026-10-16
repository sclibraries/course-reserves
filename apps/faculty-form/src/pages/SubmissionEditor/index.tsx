import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { useSubmissionEditor } from '@/hooks/useSubmissionEditor';
import { usePreviousCourseDetection } from '@/hooks/usePreviousCourseDetection';
import { useCourseCloning } from '@/hooks/useCourseCloning';
import { useOrganizedContent, useFilteredAndSortedContent } from '@/hooks/useContentOrganization';
import { useDraftSaving } from '@/hooks/useDraftSaving';
import { useSubmissionLock } from '@/hooks/useSubmissionLock';
import { hasLocalMaterialEdits } from '@/store/reserve/submissionRefetchMerge';
import { SubmissionLockBanner } from '@/components/SubmissionLockBanner';
import { useReserveStore } from '@/store/useReserveStore';
import { EMPTY_ADDED_MATERIALS, useAddedMaterialsVisitStore } from '@/store/addedMaterialsVisitStore';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import type { DraftPayload } from '@/store/draftStore';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import { createItemHandlers } from '@/handlers/itemHandlers';
import { createAddMaterialHandler } from '@/handlers/addMaterialHandler';
import { createFolderHandlers, createCourseHandlers } from '@/handlers/folderHandlers';
import { createDragHandlers } from '@/handlers/dragHandlers';
import { createSubmissionHandlers } from '@/handlers/submissionHandlers';
import { createCloneResourceHandler } from '@/handlers/cloneResourceHandler';
import { ItemModal } from '@/components/ItemModal';
import { CourseModal } from '@/components/CourseModal';
import { CloneDialog } from '@/components/CloneDialog';
import { DiscoverySearchDialog } from '@/components/DiscoverySearchDialog';
import { SyllabusUploadDialog } from '@/components/SyllabusUploadDialog';
import CorrectionRequiredDialog from '@/components/Communications/CorrectionRequiredDialog';
import SubmissionEditorContext from './SubmissionEditorContext';
import StickyStack from './StickyStack';
import ContentList from './ContentList';
import SubmitDialog from './SubmitDialog';
import DuplicateDialog from './DuplicateDialog';
import AddMaterialsPage from '../AddMaterials/AddMaterialsPage';

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
    sortBy, setSortBy, searchQuery, setSearchQuery,
    filters, setFilters, resetFilters, hasActiveFiltersOrSort,
    addItem, updateItem, deleteItem, reorderItems, moveItemToPosition, updateReserve,
    createFolder, updateFolder, deleteFolder, toggleFolder,
    addItemToFolder, removeItemFromFolder, moveItemInFolder, moveFolderPosition,
  } = useSubmissionEditor();

  const firstName = user?.full_name?.split(' ')[0] || '';
  const previousCourseDetection = usePreviousCourseDetection(id, reserve?.courseCode, reserve?.items.length ?? 0, reserve?.folders.length ?? 0, firstName);

  const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);
  const [cloneDialogMode, setCloneDialogMode] = React.useState<'exact' | 'all'>('exact');
  const [cloneDialogDirectToResources, setCloneDialogDirectToResources] = React.useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = React.useState(false);
  const [duplicateSourceCourse, setDuplicateSourceCourse] = React.useState<{ term: string; courseName: string; resourceCount: number; electronicCount: number; physicalCount: number } | null>(null);
  const [loadingDuplicateSource, setLoadingDuplicateSource] = React.useState(false);
  const [discoverySearchOpen, setDiscoverySearchOpen] = React.useState(false);
  const [syllabusUploadOpen, setSyllabusUploadOpen] = React.useState(false);

  const { fetchPreviousCourses } = useCourseCloning();

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

  const { saveDraft, markChanged, lastSaveTime, saveError, hasUnsavedChanges, isSaving } = useDraftSaving(id, reserve, {
    autoSaveEnabled: !isReadOnly, autoSaveDelay: 3000,
    onSave: async (payload: DraftPayload) => { console.log('Saving draft:', payload); return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 500)); },
    onSaveSuccess: () => { console.log('Draft save succeeded'); },
    onSaveError: (e) => { console.error('Draft save failed:', e); },
  });
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
    toast.success(`Added: ${item.title}`, {
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
    getLastAddedItem: () => {
      const items = useReserveStore.getState().getReserveById(id || '')?.items || [];
      return items[items.length - 1];
    },
    onAdded: onAddedMaterial,
  });
  const hasLocalEdits = hasLocalMaterialEdits(reserve, serverReserveSnapshotRef.current);

  useUnsavedChangesWarning(true, hasUnsavedChanges);
  const organizedContent = useOrganizedContent(reserve);
  const filteredAndSortedContent = useFilteredAndSortedContent(organizedContent, searchQuery, filters, sortBy);

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

  const isEditingSubmission = reserve.status === 'submitted';

  const wrappedUpdateItem = (...a: Parameters<typeof updateItem>) => { updateItem(...a); markChanged(); };
  const wrappedDeleteItem = (...a: Parameters<typeof deleteItem>) => { deleteItem(...a); markChanged(); };
  const wrappedUpdateReserve = (...a: Parameters<typeof updateReserve>) => { updateReserve(...a); markChanged(); };
  const wrappedCreateFolder = (...a: Parameters<typeof createFolder>) => { const r = createFolder(...a); markChanged(); return r; };
  const wrappedUpdateFolder = (...a: Parameters<typeof updateFolder>) => { updateFolder(...a); markChanged(); };
  const wrappedDeleteFolder = (...a: Parameters<typeof deleteFolder>) => { deleteFolder(...a); markChanged(); };
  const wrappedReorderItems = (...a: Parameters<typeof reorderItems>) => { reorderItems(...a); markChanged(); };
  const wrappedAddItemToFolder = (...a: Parameters<typeof addItemToFolder>) => { addItemToFolder(...a); markChanged(); };

  const itemHandlers = createItemHandlers(id!, wrappedAddItem, wrappedUpdateItem, wrappedDeleteItem, moveItemToPosition, wrappedUpdateReserve, reserve.items, hasActiveFiltersOrSort, setEditingItem, setModalOpen);
  const folderHandlers = createFolderHandlers(id!, wrappedCreateFolder, wrappedUpdateFolder, wrappedDeleteFolder, toggleFolder);
  const courseHandlers = createCourseHandlers(id!, wrappedUpdateReserve, setCourseModalOpen);
  const dragHandlers = createDragHandlers(id!, reserve.items, wrappedReorderItems, wrappedAddItemToFolder, hasActiveFiltersOrSort);
  const submissionHandlers = createSubmissionHandlers(navigate, reserve, organizedContent, setShowSubmitDialog);
  const cloneResourceHandler = createCloneResourceHandler(reserve, id, wrappedAddItem, !isAddMaterialsPage);

  const handleOpenCloneDialog = (mode: 'exact' | 'all' = 'exact', directToResources = false) => { setCloneDialogMode(mode); setCloneDialogDirectToResources(directToResources); setCloneDialogOpen(true); };

  const handleOpenDuplicateDialog = async () => {
    if (!reserve?.courseCode || !user?.full_name) { setShowDuplicateDialog(true); return; }
    setLoadingDuplicateSource(true);
    try {
      const courses = await fetchPreviousCourses(reserve.courseCode, user.full_name, 'exact');
      setDuplicateSourceCourse(courses?.[0] ? { term: courses[0].term, courseName: courses[0].courseName, resourceCount: courses[0].resourceCount, electronicCount: courses[0].electronicCount, physicalCount: courses[0].physicalCount } : null);
    } catch { setDuplicateSourceCourse(null); } finally { setLoadingDuplicateSource(false); setShowDuplicateDialog(true); }
  };

  const handleItemsFromExternalSource = (items: Partial<CourseItem>[]) => {
    let skippedCount = 0;

    items.forEach((item) => {
      const added = wrappedAddItem(id!, {
        ...item,
        status: item.status || 'draft',
        materialType: item.materialType || 'other',
        title: item.title || 'Untitled',
      });

      if (!added) skippedCount += 1;
    });

    if (skippedCount > 0) {
      toast.error(`${skippedCount} duplicate item${skippedCount === 1 ? '' : 's'} skipped.`);
    }
  };

  const ctxValue = {
    id: id!, reserve, isEditingSubmission,
    hasPreviousOffering: previousCourseDetection.hasExactMatchCourses,
    isReadOnly, lockInfo,
    saveDraft, isSaving, hasUnsavedChanges, lastSaveTime, saveError,
    duplicateSourceCourse, loadingDuplicateSource, handleOpenDuplicateDialog, handleOpenCloneDialog,
    setDiscoverySearchOpen, setSyllabusUploadOpen,
    itemHandlers, folderHandlers, courseHandlers, dragHandlers, submissionHandlers,
    markChanged,
    removeItemFromFolder: (...a: Parameters<typeof removeItemFromFolder>) => { removeItemFromFolder(...a); markChanged(); },
    moveItemInFolder: (...a: Parameters<typeof moveItemInFolder>) => { moveItemInFolder(...a); markChanged(); },
    addItemToFolder: (...a: Parameters<typeof addItemToFolder>) => { addItemToFolder(...a); markChanged(); },
    moveFolderPosition: (...a: Parameters<typeof moveFolderPosition>) => { moveFolderPosition(...a); markChanged(); },
    user, updateReserve: wrappedUpdateReserve, addItem: wrappedAddItem,
    addItemsFromExternalSource: handleItemsFromExternalSource,
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
          <div className="mb-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{reserve.courseCode} · {reserve.courseTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">Section {reserve.section} · {reserve.term}</p>
              </div>
              <Button variant="outline" size="sm" onClick={courseHandlers.handleEditCourse} disabled={isReadOnly}>
                <Edit className="mr-2 h-3 w-3" />Edit Course Info
              </Button>
            </div>
          </div>
          {hasRemoteItemsChanged && (
            <div role="status" className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              This submission was updated elsewhere. Your unsaved changes are kept.
            </div>
          )}
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
              filteredAndSortedContent={filteredAndSortedContent}
              sortBy={sortBy} setSortBy={setSortBy}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              filters={filters} setFilters={setFilters}
              resetFilters={resetFilters} hasActiveFiltersOrSort={hasActiveFiltersOrSort}
            />
          </fieldset>
        </main>
        )}
        <ItemModal open={modalOpen} onOpenChange={setModalOpen} onSave={(data) => itemHandlers.handleSaveItem(data, editingItem)} initialData={editingItem} showSuccessToast={!isAddMaterialsPage} />
        <SubmitDialog showSubmitDialog={showSubmitDialog} setShowSubmitDialog={setShowSubmitDialog} emailConfirmation={emailConfirmation} setEmailConfirmation={setEmailConfirmation} />
        <DuplicateDialog showDuplicateDialog={showDuplicateDialog} setShowDuplicateDialog={setShowDuplicateDialog} reserve={reserve} user={user} id={id!} emailConfirmation={emailConfirmation} setEmailConfirmation={setEmailConfirmation} updateReserve={wrappedUpdateReserve} submissionHandlers={submissionHandlers} addItem={wrappedAddItem} duplicateSourceCourse={duplicateSourceCourse} addToCurrentReserve={isAddMaterialsPage} />
        <CourseModal open={courseModalOpen} onOpenChange={setCourseModalOpen} onSave={courseHandlers.handleSaveCourse} initialData={{ courseCode: reserve.courseCode, courseTitle: reserve.courseTitle, section: reserve.section, instructors: reserve.instructors, term: reserve.term }} isEditing={true} />
        <CloneDialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen} reserveId={id!} courseCode={reserve.courseCode} userName={user?.full_name || ''} currentItemsCount={reserve.items.length} onAddResource={cloneResourceHandler.handleAddSingleResource} initialMode={cloneDialogMode} directToResources={cloneDialogDirectToResources} />
        <DiscoverySearchDialog open={discoverySearchOpen} onOpenChange={setDiscoverySearchOpen} onItemsSelected={handleItemsFromExternalSource} />
        <SyllabusUploadDialog open={syllabusUploadOpen} onOpenChange={setSyllabusUploadOpen} onItemsExtracted={handleItemsFromExternalSource} />
        <CorrectionRequiredDialog />
      </div>
    </SubmissionEditorContext.Provider>
  );
};

export default SubmissionEditor;

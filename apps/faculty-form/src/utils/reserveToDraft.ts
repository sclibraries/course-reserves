import type { CourseReserve } from '@/store/reserve/types';
import type { DraftItemPayload, DraftFolderPayload, DraftPayload } from '@/store/draftStore';
import { toPayloadOrder } from './listLayout';
import { getLayoutState } from '@/store/reserve/layoutState';

export function convertReserveToDraft(reserve: CourseReserve, currentVersion = 0): DraftPayload {
  const order = toPayloadOrder(getLayoutState(reserve));
  const items: DraftItemPayload[] = reserve.items.map((item) => ({
    id: item.id,
    backendItemId: item.backendItemId || null,
    title: item.title,
    materialType: item.materialType,
    status: item.status,
    authors: item.authors || null,
    isbn: item.isbn || null,
    publisher: item.publisher || null,
    publicationYear: item.publicationYear || null,
    edition: item.edition || null,
    pages: item.pages || null,
    chapterTitle: item.chapterTitle || null,
    journalTitle: item.journalTitle || null,
    volume: item.volume || null,
    issue: item.issue || null,
    doi: item.doi || null,
    issn: item.issn || null,
    eds: item.eds || null,
    url: item.url || null,
    notes: item.notes || null,
    libraryNotes: item.libraryNotes || null,
    folderId: item.folderId || null,
    displayOrder: order.resourceOrder[item.id]?.displayOrder ?? null,
    displayStartDate: item.displayStartDate || null,
    displayEndDate: item.displayEndDate || null,
    hasAttachment: item.hasAttachment || false,
    attachmentName: item.attachmentName || null,
    attachmentSize: item.attachmentSize || null,
    attachmentType: item.attachmentType || null,
    barcode: item.barcode || null,
    callNumber: item.callNumber || null,
    copy: item.copy || null,
    instanceId: item.instanceId || null,
    holdingsId: item.holdingsId || null,
    instanceHrid: item.instanceHrid || null,
    temporaryLocationId: item.temporaryLocationId || null,
    permanentLocationId: item.permanentLocationId || null,
    copiedItem: item.copiedItem || null,
  }));
  const folders: DraftFolderPayload[] = reserve.folders.map((folder) => ({
    id: folder.id,
    backendFolderId: folder.backendFolderId || null,
    title: folder.title,
    description: folder.description || null,
    position: order.folderOrder[folder.id] ?? null,
    isOpen: folder.isOpen,
  }));

  return {
    uuid: reserve.id,
    courseCode: reserve.courseCode,
    courseTitle: reserve.courseTitle,
    section: reserve.section,
    instructors: reserve.instructors,
    term: reserve.term,
    submissionNotes: reserve.submissionNotes || null,
    neededByDate: reserve.neededByDate || null,
    courseAssignmentId: reserve.courseAssignmentId || null,
    items,
    folders,
    isDraft: true,
    lastSavedAt: new Date().toISOString(),
    draftVersion: currentVersion + 1,
  };
}

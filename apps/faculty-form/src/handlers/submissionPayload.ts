import { useAuthStore } from '@/store/authStore';
import type { CourseReserve, CourseFolder, CourseItem } from '@/store/courseReservesStore';
import { withActingForFaculty } from './actingForPayload';
import { withRosterCourse } from './rosterSubmissionPayload';
import { transformItemForBackend } from './submissionResourcePayload';
import { toPayloadOrder } from '@/utils/listLayout';
import { getLayoutState } from '@/store/reserve/layoutState';
import type { OrganizedContent } from '@/utils/contentSearch';

type SubmissionFolder = CourseFolder & { items: CourseItem[]; position: number };

export const buildSubmissionPayload = (
  reserve: CourseReserve,
  emailConfirmation = false,
  organizedContent?: OrganizedContent,
) => {
  const layout = getLayoutState(reserve);
  const order = toPayloadOrder(layout);
  const itemsById = new Map(layout.items.map((item) => [item.id, item]));
  const foldersWithItems: SubmissionFolder[] = (organizedContent?.folders || layout.folders).map((folder) => ({
    id: folder.id,
    backendFolderId: folder.backendFolderId,
    title: folder.title,
    description: folder.description,
    position: order.folderOrder[folder.id] ?? 0,
    isOpen: folder.isOpen,
    items: organizedContent?.folders
      ? folder.items
      : folder.itemIds.map((itemId) => itemsById.get(itemId)).filter((item): item is CourseItem => !!item),
  }));
  const submittedItems = layout.items;
  const transformedResources = submittedItems.map((item) => {
    const folder = foldersWithItems.find((candidate) => candidate.id === item.folderId);
    const positionInfo = order.resourceOrder[item.id] || { displayOrder: 0, positionInFolder: null };
    return {
      ...transformItemForBackend(item, positionInfo.displayOrder, folder?.title),
      position_in_folder: positionInfo.positionInFolder,
    };
  });
  const user = useAuthStore.getState().user;
  const submissionData = {
    reserveId: reserve.id,
    courseInfo: {
      courseCode: reserve.courseCode,
      courseTitle: reserve.courseTitle,
      section: reserve.section,
      instructors: reserve.instructors,
      term: reserve.term,
      status: reserve.status,
      lastUpdated: reserve.lastUpdated,
    },
    items: submittedItems,
    resources: transformedResources,
    folders: foldersWithItems,
    displayOrder: order.displayOrder,
    metadata: {
      totalItems: submittedItems.length,
      totalFolders: foldersWithItems.length,
      itemsInFolders: submittedItems.filter((item) => item.folderId).length,
      ungroupedItems: submittedItems.filter((item) => !item.folderId).length,
      reuseItems: transformedResources.filter((resource) => resource.is_reuse).length,
      newItems: transformedResources.filter((resource) => !resource.is_reuse).length,
      submittedAt: new Date().toISOString(),
      emailConfirmation,
      submittedBy: user ? {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        institution: user.institution,
      } : null,
    },
  };

  return withActingForFaculty(withRosterCourse(submissionData, reserve));
};

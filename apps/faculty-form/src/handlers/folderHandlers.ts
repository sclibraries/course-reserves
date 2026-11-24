import { notify } from "@/services/notify";
import type { CourseData } from "@/components/CourseModal";
import type { CourseFolder, CourseReserve } from "../store/courseReservesStore";
import { findFolderByName } from '@/utils/folderNames';

/**
 * Handlers for folder-related operations
 */
export const createFolderHandlers = (
  reserveId: string,
  folders: readonly Pick<CourseFolder, 'id' | 'title'>[],
  createFolder: (id: string, title: string) => void,
  updateFolder: (id: string, folderId: string, updates: Partial<Pick<CourseFolder, 'title' | 'description' | 'isOpen'>>) => void,
  deleteFolder: (id: string, folderId: string) => void,
  toggleFolder: (id: string, folderId: string) => void
) => {
  const handleCreateFolder = () => {
    const title = prompt("Enter folder name:");
    if (title?.trim()) {
      const trimmedTitle = title.trim();
      const existing = findFolderByName(folders, trimmedTitle);
      if (existing) {
        notify.error(`A folder named "${existing.title}" already exists.`);
        return;
      }
      createFolder(reserveId, trimmedTitle);
      notify.success('Folder created');
    }
  };

  const handleUpdateFolder = (folderId: string, updates: Partial<Pick<CourseFolder, 'title' | 'description' | 'isOpen'>>) => {
    if (updates.title) {
      const existing = findFolderByName(folders, updates.title, folderId);
      if (existing) {
        notify.error(`A folder named "${existing.title}" already exists.`);
        return;
      }
    }
    updateFolder(reserveId, folderId, updates);
    if (updates.title) notify.success(`Folder renamed to ${updates.title}`);
  };

  const handleDeleteFolder = (folderId: string) => {
    deleteFolder(reserveId, folderId);
    notify.success('Folder deleted');
  };

  const handleToggleFolder = (folderId: string) => {
    toggleFolder(reserveId, folderId);
  };

  return {
    handleCreateFolder,
    handleUpdateFolder,
    handleDeleteFolder,
    handleToggleFolder,
  };
};

/**
 * Handlers for course-related operations
 */
export const createCourseHandlers = (
  reserveId: string,
  updateReserve: (id: string, updates: Partial<CourseReserve>) => void,
  setCourseModalOpen: (open: boolean) => void
) => {
  const handleEditCourse = () => {
    setCourseModalOpen(true);
  };

  const handleSaveCourse = (courseData: CourseData) => {
    updateReserve(reserveId, {
      courseCode: courseData.courseCode,
      courseTitle: courseData.courseTitle,
      section: courseData.section,
      instructors: courseData.instructors,
      term: courseData.term,
    });
    setCourseModalOpen(false);
    notify.success('Course details updated');
  };

  return {
    handleEditCourse,
    handleSaveCourse,
  };
};

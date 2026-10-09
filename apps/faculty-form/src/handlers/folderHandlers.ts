import { toast } from "sonner";
import type { CourseData } from "@/components/CourseModal";
import type { CourseFolder, CourseReserve } from "../store/courseReservesStore";

/**
 * Handlers for folder-related operations
 */
export const createFolderHandlers = (
  reserveId: string,
  createFolder: (id: string, title: string) => void,
  updateFolder: (id: string, folderId: string, updates: Partial<Pick<CourseFolder, 'title' | 'description' | 'isOpen'>>) => void,
  deleteFolder: (id: string, folderId: string) => void,
  toggleFolder: (id: string, folderId: string) => void
) => {
  const handleCreateFolder = () => {
    const title = prompt("Enter folder name:");
    if (title?.trim()) {
      createFolder(reserveId, title.trim());
      toast.success("Folder created");
    }
  };

  const handleUpdateFolder = (folderId: string, updates: Partial<Pick<CourseFolder, 'title' | 'description' | 'isOpen'>>) => {
    updateFolder(reserveId, folderId, updates);
  };

  const handleDeleteFolder = (folderId: string) => {
    deleteFolder(reserveId, folderId);
    toast.success("Folder deleted");
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
    toast.success("Course details updated");
  };

  return {
    handleEditCourse,
    handleSaveCourse,
  };
};

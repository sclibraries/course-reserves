// Re-export everything from the split stores for backward compatibility.
// All existing `import { useCourseReservesStore } from '@/store/courseReservesStore'`
// and type imports continue to work without modification.

export type {
  FolioLocation,
  FolioCopiedItem,
  CourseItem,
  CourseFolder,
  CourseReserveItem,
  CourseReserve,
} from './useReserveStore';

export { clearCourseReservesStorage } from './useReserveStore';
export { useReserveStore } from './useReserveStore';
export { useFolderStore } from './useFolderStore';
export { useEditorUIStore } from './useEditorUIStore';

// useCourseReservesStore is the canonical backward-compat alias.
export { useReserveStore as useCourseReservesStore } from './useReserveStore';

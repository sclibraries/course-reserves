import { useActingForStore } from '@/store/actingForStore';
import { useCourseAssignmentsStore } from '@/store/courseAssignmentsStore';

export const useDashboardCourseAssignments = () => {
  const selectedFaculty = useActingForStore((state) => state.selectedFaculty);
  const {
    assignments: ownAssignments,
    loading: ownLoading,
    actingForAssignments,
    actingForLoading,
    actingForCanEdit,
    actingForError,
  } = useCourseAssignmentsStore();

  return selectedFaculty
    ? {
        assignments: actingForAssignments.map((assignment) => ({
          ...assignment,
          canEdit: actingForCanEdit ?? false,
        })),
        loading: actingForLoading,
        error: actingForError,
      }
    : { assignments: ownAssignments, loading: ownLoading, error: null };
};

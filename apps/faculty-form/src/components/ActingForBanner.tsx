import { Button } from '@/components/ui/button';
import { useActingForStore } from '@/store/actingForStore';
import { useCourseAssignmentsStore } from '@/store/courseAssignmentsStore';

export const ActingForBanner = () => {
  const selectedFaculty = useActingForStore((state) => state.selectedFaculty);
  const clearSelection = useActingForStore((state) => state.clearSelection);
  const canEdit = useCourseAssignmentsStore((state) => state.actingForCanEdit);
  const clearActingForAssignments = useCourseAssignmentsStore((state) => state.clearActingForAssignments);
  const fetchOwnAssignments = useCourseAssignmentsStore((state) => state.fetchCourseAssignments);

  if (!selectedFaculty) return null;

  const switchBack = () => {
    clearSelection();
    clearActingForAssignments();
    fetchOwnAssignments().catch(() => undefined);
  };

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 border-b bg-primary/10 px-4 py-2 text-sm"
    >
      <span>Acting for {selectedFaculty.displayName}</span>
      <span className="text-muted-foreground">{canEdit === null ? 'Loading access' : canEdit ? 'Can edit' : 'View only'}</span>
      <Button size="sm" variant="outline" onClick={switchBack}>Switch back to myself</Button>
    </div>
  );
};

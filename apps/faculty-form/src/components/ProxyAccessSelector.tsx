import { useActingForStore } from '@/store/actingForStore';
import { useCourseAssignmentsStore } from '@/store/courseAssignmentsStore';
import { useProxyAccessGrants } from '@/hooks/useProxyAccessGrants';

export const ProxyAccessSelector = () => {
  const selectedFaculty = useActingForStore((state) => state.selectedFaculty);
  const selectFaculty = useActingForStore((state) => state.selectFaculty);
  const clearSelection = useActingForStore((state) => state.clearSelection);
  const fetchMyCourses = useCourseAssignmentsStore((state) => state.fetchCourseAssignments);
  const fetchActingForAssignments = useCourseAssignmentsStore((state) => state.fetchActingForAssignments);
  const clearActingForAssignments = useCourseAssignmentsStore((state) => state.clearActingForAssignments);
  const actingForError = useCourseAssignmentsStore((state) => state.actingForError);
  const { activeGrants, accessError } = useProxyAccessGrants();

  const changeFaculty = (username: string) => {
    if (!username) {
      clearSelection();
      clearActingForAssignments();
      fetchMyCourses().catch(() => undefined);
      return;
    }

    const grant = activeGrants.find((item) => item.faculty_id === username);
    if (!grant) return;
    selectFaculty({
      username,
      displayName: grant.faculty_display_name || username,
    });
    fetchActingForAssignments(username, grant.permission_type !== 'view_only').catch(() => undefined);
  };

  const showSelector = activeGrants.length > 0;
  const error = actingForError || accessError;
  if (!showSelector && !error) return null;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {showSelector && (
        <label className="flex items-center gap-2 text-sm">
          <span>Working as:</span>
          <select
            aria-label="Working as"
            className="rounded-md border bg-background px-2 py-1"
            value={selectedFaculty?.username || ''}
            onChange={(event) => changeFaculty(event.target.value)}
          >
            <option value="">Myself</option>
            {activeGrants.map((grant) => (
              <option key={grant.permission_id} value={grant.faculty_id}>
                {grant.faculty_display_name || grant.faculty_id}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

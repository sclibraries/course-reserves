import { useEffect, useState } from 'react';
import { getMyFacultyAccess, type FacultyProxyGrant } from '@/services/api/facultyProxyApi';
import { useAuthStore } from '@/store/authStore';
import { useActingForStore } from '@/store/actingForStore';
import { useCourseAssignmentsStore } from '@/store/courseAssignmentsStore';

const errorMessage = (error: unknown) => {
  const responseData = (error as { response?: { data?: { message?: string; error?: string } } })
    .response?.data;
  return responseData?.message || responseData?.error ||
    (error instanceof Error ? error.message : 'Unable to load proxy access');
};

export const ProxyAccessSelector = ({ renderSelector = true }: { renderSelector?: boolean }) => {
  const user = useAuthStore((state) => state.user);
  const selectedFaculty = useActingForStore((state) => state.selectedFaculty);
  const selectFaculty = useActingForStore((state) => state.selectFaculty);
  const clearSelection = useActingForStore((state) => state.clearSelection);
  const fetchMyCourses = useCourseAssignmentsStore((state) => state.fetchCourseAssignments);
  const fetchActingForAssignments = useCourseAssignmentsStore((state) => state.fetchActingForAssignments);
  const clearActingForAssignments = useCourseAssignmentsStore((state) => state.clearActingForAssignments);
  const actingForError = useCourseAssignmentsStore((state) => state.actingForError);
  const [activeGrants, setActiveGrants] = useState<FacultyProxyGrant[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    let current = true;
    if (!useActingForStore.getState().selectedFaculty) fetchMyCourses().catch(() => undefined);

    getMyFacultyAccess().then(({ items }) => {
      if (!current) return;
      const grants = (items || []).filter((grant) => grant.status === 'active' && grant.faculty_id);
      setActiveGrants(grants);
      setAccessError(null);

      const selected = useActingForStore.getState().selectedFaculty;
      const grant = grants.find((item) => item.faculty_id === selected?.username);
      if (selected && !grant) {
        clearSelection();
        clearActingForAssignments();
        fetchMyCourses().catch(() => undefined);
      } else if (selected && grant) {
        const displayName = grant.faculty_display_name || selected.displayName;
        if (displayName !== selected.displayName) {
          selectFaculty({ username: selected.username, displayName });
        }
        fetchActingForAssignments(
          selected.username,
          grant.permission_type !== 'view_only',
        ).catch(() => undefined);
      }
    }).catch((error) => {
      if (current) setAccessError(errorMessage(error));
    });

    return () => { current = false; };
  }, [
    user?.username,
    clearActingForAssignments,
    clearSelection,
    fetchActingForAssignments,
    fetchMyCourses,
    selectFaculty,
  ]);

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

  const showSelector = renderSelector && activeGrants.length > 0;
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

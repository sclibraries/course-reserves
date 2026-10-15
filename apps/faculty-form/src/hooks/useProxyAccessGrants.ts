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

export const useProxyAccessGrants = ({ loadCourses = true }: { loadCourses?: boolean } = {}) => {
  const user = useAuthStore((state) => state.user);
  const selectFaculty = useActingForStore((state) => state.selectFaculty);
  const clearSelection = useActingForStore((state) => state.clearSelection);
  const fetchMyCourses = useCourseAssignmentsStore((state) => state.fetchCourseAssignments);
  const fetchActingForAssignments = useCourseAssignmentsStore((state) => state.fetchActingForAssignments);
  const clearActingForAssignments = useCourseAssignmentsStore((state) => state.clearActingForAssignments);
  const [activeGrants, setActiveGrants] = useState<FacultyProxyGrant[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    let current = true;
    if (loadCourses && !useActingForStore.getState().selectedFaculty) fetchMyCourses().catch(() => undefined);

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
        if (loadCourses) fetchMyCourses().catch(() => undefined);
      } else if (selected && grant) {
        const displayName = grant.faculty_display_name || selected.displayName;
        if (displayName !== selected.displayName) {
          selectFaculty({ username: selected.username, displayName });
        }
        if (loadCourses) {
          fetchActingForAssignments(
            selected.username,
            grant.permission_type !== 'view_only',
          ).catch(() => undefined);
        }
      }
    }).catch((error) => {
      if (current) setAccessError(errorMessage(error));
    });

    return () => { current = false; };
  }, [
    user?.username,
    loadCourses,
    clearActingForAssignments,
    clearSelection,
    fetchActingForAssignments,
    fetchMyCourses,
    selectFaculty,
  ]);

  return { activeGrants, accessError };
};

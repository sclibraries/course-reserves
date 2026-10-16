import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '@/config/endpoints';
import apiClient from '@/services/apiClient';

// Types for course assignments from the backend
export interface CourseAssignment {
  canEdit?: boolean;
  assignment: {
    academic_period: string;
    course_id: string;
    course_title: string;
    smith_id: string;
    role: string;
    created_at: string;
    updated_at: string;
  };
  parsed_course: {
    courseNumber: string;
    sectionName: string;
    raw: string;
  };
  folio_term?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    metadata?: unknown;
  } | null;
  folio_course: {
    id?: string;
    name?: string;
    courseNumber?: string;
    sectionName?: string;
    source?: string;
    message?: string;
    departmentId?: string;
    departmentObject?: unknown;
    courseListingId?: string;
    courseListingObject?: unknown;
    metadata?: unknown;
  };
}

interface CourseAssignmentsState {
  // Data
  assignments: CourseAssignment[];
  loading: boolean;
  error: string | null;
  actingForAssignments: CourseAssignment[];
  actingForLoading: boolean;
  actingForError: string | null;
  actingForCanEdit: boolean | null;
  
  // Actions
  fetchCourseAssignments: () => Promise<void>;
  fetchActingForAssignments: (facultyUsername: string, canEditFallback?: boolean) => Promise<void>;
  clearActingForAssignments: () => void;
  clearAssignments: () => void;
}

export const useCourseAssignmentsStore = create<CourseAssignmentsState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        assignments: [],
        loading: false,
        error: null,
        actingForAssignments: [],
        actingForLoading: false,
        actingForError: null,
        actingForCanEdit: null,

        // Fetch course assignments from backend
        fetchCourseAssignments: async () => {
        console.log('🔍 Fetching authenticated course assignments');
        set({ loading: true, error: null });
        
        try {
          const response = await apiClient.get(
            `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.COURSE_ASSIGNMENTS}`,
          );
          const data = response.data;
          
          if (data.success && data.courses) {
            console.log('✅ Course assignments loaded:', data.courses.length, 'courses');
            set({
              assignments: data.courses,
              loading: false,
              error: null,
            });
          } else {
            console.log('ℹ️ No course assignments found');
            set({
              assignments: [],
              loading: false,
              error: null,
            });
          }
        } catch (error) {
          console.error('❌ Failed to fetch course assignments:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch course assignments';
          set({
            assignments: [],
            loading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      fetchActingForAssignments: async (facultyUsername, canEditFallback = true) => {
        set({
          actingForAssignments: [],
          actingForLoading: true,
          actingForError: null,
          actingForCanEdit: canEditFallback,
        });

        try {
          const response = await apiClient.get(
            `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.COURSE_ASSIGNMENTS}`,
            { params: { acting_for_faculty_id: facultyUsername } },
          );
          const data = response.data;
          const courses = data.success && Array.isArray(data.courses) ? data.courses : [];

          set({
            actingForAssignments: courses,
            actingForCanEdit: typeof data.can_edit === 'boolean' ? data.can_edit : canEditFallback,
            actingForLoading: false,
            actingForError: null,
          });
        } catch (error) {
          const responseData = (error as { response?: { data?: { message?: string; error?: string; error_code?: string } } })
            .response?.data;
          const errorMessage = responseData?.message || responseData?.error ||
            (responseData?.error_code === 'proxy_roster_unavailable'
              ? 'Your faculty member must re-invite you to restore course access.'
              : null) ||
            (error instanceof Error ? error.message : 'Failed to fetch the faculty course list');

          set({
            actingForAssignments: [],
            actingForCanEdit: null,
            actingForLoading: false,
            actingForError: errorMessage,
          });
          throw error;
        }
      },

      clearActingForAssignments: () => {
        set({
          actingForAssignments: [],
          actingForLoading: false,
          actingForError: null,
          actingForCanEdit: null,
        });
      },

      // Clear course assignments
      clearAssignments: () => {
        console.log('🗑️ Clearing course assignments');
        set({
          assignments: [],
          loading: false,
          error: null,
        });
      },
    }),
    {
      name: 'course-assignments-storage',
      partialize: (state) => ({
        assignments: state.assignments,
      }),
    }
    ),
    { name: 'courseAssignments' }
  )
);

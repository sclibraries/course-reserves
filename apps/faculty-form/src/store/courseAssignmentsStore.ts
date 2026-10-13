import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '@/config/endpoints';
import apiClient from '@/services/apiClient';

// Types for course assignments from the backend
export interface CourseAssignment {
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
  folio_term: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    metadata?: unknown;
  };
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
  
  // Actions
  fetchCourseAssignments: () => Promise<void>;
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

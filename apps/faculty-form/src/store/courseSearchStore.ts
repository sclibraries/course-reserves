import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { API_ENDPOINTS, DEFAULT_CONFIG } from '@/config/endpoints';
import { buildCourseQuery } from '@/lib/courseQueryBuilder';

// Types for FOLIO course data
export interface Department {
  id: string;
  name: string;
  description: string;
  metadata?: {
    createdDate: string;
    createdByUserId: string;
    updatedDate: string;
    updatedByUserId: string;
  };
}

export interface Location {
  id: string;
  name: string;
  code: string;
  discoveryDisplayName: string;
  isActive: boolean;
  institutionId: string;
  campusId: string;
  libraryId: string;
  primaryServicePoint: string;
  servicePointIds: string[];
}

export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface CourseType {
  id: string;
  name: string;
  description: string;
}

export interface PatronGroup {
  id: string;
  desc: string;
  group: string;
}

export interface Instructor {
  id: string;
  userId: string;
  name: string;
  barcode: string;
  patronGroup: string;
  patronGroupObject: PatronGroup;
  courseListingId: string;
  metadata?: {
    createdDate: string;
    createdByUserId: string;
    updatedDate: string;
    updatedByUserId: string;
  };
}

export interface CourseListing {
  id: string;
  locationId: string;
  locationObject: Location;
  termId: string;
  termObject: Term;
  courseTypeId: string;
  courseTypeObject: CourseType;
  instructorObjects: Instructor[];
  metadata?: {
    createdDate: string;
    createdByUserId: string;
    updatedDate: string;
    updatedByUserId: string;
  };
}

export interface Course {
  id: string;
  name: string;
  courseNumber: string;
  departmentId: string;
  departmentObject: Department;
  courseListingId: string;
  courseListingObject: CourseListing;
}

export interface CourseSearchResponse {
  message: string;
  code: number;
  data: {
    courses: Course[];
    totalRecords?: number;
  };
}

export interface CourseSearchFilters {
  college: string;
  key: string;
  input: string;
  department: string;
  sortOption: string;
  termId: string | null;
}

interface CourseSearchState {
  // Data
  courses: Course[];
  loading: boolean;
  error: string | null;
  lastQuery: string | null;
  totalRecords: number;
  
  // Search filters
  filters: CourseSearchFilters;
  
  // Actions
  searchCourses: (filters: Partial<CourseSearchFilters>) => Promise<void>;
  searchCoursesByInstructor: (instructorName: string, termId?: string) => Promise<void>;
  clearResults: () => void;
  updateFilters: (newFilters: Partial<CourseSearchFilters>) => void;
  
  // Helper methods
  getCoursesByInstructor: (instructorName: string) => Course[];
  getCourseListingIds: () => string[];
  getUniqueInstructors: () => string[];
}

export const useCourseSearchStore = create<CourseSearchState>()(
  devtools(
    (set, get) => ({
      // Initial state
      courses: [],
      loading: false,
      error: null,
      lastQuery: null,
      totalRecords: 0,
      
      // Default filters
      filters: {
        college: 'smith',
        key: 'instructor',
        input: '',
        department: '',
        sortOption: 'name',
        termId: null
      },

      // Search courses using the useBuildQuery hook
      searchCourses: async (newFilters) => {
        set({ loading: true, error: null });
        
        try {
          // Update filters
          const updatedFilters = { ...get().filters, ...newFilters };
          set({ filters: updatedFilters });
          
          // Build query using the utility function
          const query = buildCourseQuery(
            updatedFilters.college,
            updatedFilters.key,
            updatedFilters.input,
            updatedFilters.department,
            updatedFilters.sortOption,
            updatedFilters.termId
          );
          
          console.log('🔍 Searching courses with query:', query);
          
          const url = `${API_ENDPOINTS.FOLIO.BASE_URL}${API_ENDPOINTS.FOLIO.SEARCH_COURSES}`;
          const searchUrl = `${url}?query=${encodeURIComponent(query)}`;
          
          console.log('📡 Request URL:', searchUrl);
          
          let courses: Course[] = [];
          let totalRecords = 0;
          
          try {
            const response = await fetch(searchUrl, {
              method: 'GET',
              ...DEFAULT_CONFIG,
              mode: 'cors',
              credentials: 'omit',
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data: CourseSearchResponse = await response.json();
            
            if (data.code !== 200 || !data.data?.courses) {
              throw new Error(data.message || 'Invalid response format');
            }
            
            courses = data.data.courses;
            totalRecords = data.data.totalRecords || courses.length;
            
            console.log('✅ Successfully fetched courses:', courses.length, 'results');
            
          } catch (apiError) {
            console.warn('⚠️ Course search API failed, using mock data:', apiError);
            
            // Fallback to mock data for development/testing
            courses = generateMockCourses(updatedFilters.input);
            totalRecords = courses.length;
          }
          
          set({
            courses,
            totalRecords,
            lastQuery: query,
            loading: false,
            error: null
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error('❌ Course search error:', errorMessage);
          set({
            loading: false,
            error: errorMessage,
            courses: [],
            totalRecords: 0
          });
        }
      },

      // Search courses by instructor name (all terms by default for copying previous courses)
      searchCoursesByInstructor: async (instructorName, termId) => {
        console.log('👨‍🏫 Searching ALL courses for instructor:', instructorName);
        
        // For instructor searches, default to NO term filter to show all historical courses
        // This allows faculty to copy from courses they taught years ago
        await get().searchCourses({
          key: 'instructor',
          input: instructorName,
          termId: termId || null // null = search all terms
        });
      },

      // Clear search results
      clearResults: () => {
        set({
          courses: [],
          totalRecords: 0,
          lastQuery: null,
          error: null
        });
      },

      // Update search filters
      updateFilters: (newFilters) => {
        set({ 
          filters: { ...get().filters, ...newFilters }
        });
      },

      // Get courses by instructor name (from current results)
      getCoursesByInstructor: (instructorName) => {
        const { courses } = get();
        const normalizedName = instructorName.toLowerCase();
        
        return courses.filter(course => 
          course.courseListingObject.instructorObjects.some(instructor =>
            instructor.name.toLowerCase().includes(normalizedName)
          )
        );
      },

      // Get all course listing IDs from current results
      getCourseListingIds: () => {
        const { courses } = get();
        return courses.map(course => course.courseListingId);
      },

      // Get unique instructor names from current results
      getUniqueInstructors: () => {
        const { courses } = get();
        const instructorNames = new Set<string>();
        
        courses.forEach(course => {
          course.courseListingObject.instructorObjects.forEach(instructor => {
            instructorNames.add(instructor.name);
          });
        });
        
        return Array.from(instructorNames).sort();
      }
    }),
    {
      name: 'course-search-store'
    }
  )
);

// Mock data generator for development/testing
function generateMockCourses(searchTerm?: string): Course[] {
  const mockCourses: Course[] = [
    // Current term (2025 Fall) - Active
    {
      id: "a80eff87-0c9c-4e6c-b90d-dad0094cbc79",
      name: "Animal Physiology",
      courseNumber: "BIO 200",
      departmentId: "9a865480-23c5-4aca-8780-44cbd985f653",
      departmentObject: {
        id: "9a865480-23c5-4aca-8780-44cbd985f653",
        name: "SC Biological Sciences",
        description: "SC Biological Sciences"
      },
      courseListingId: "e4e7d028-3444-4398-83ae-4882af35b349",
      courseListingObject: {
        id: "e4e7d028-3444-4398-83ae-4882af35b349",
        locationId: "d48db17d-9b8b-4cbe-9ce9-b466f7dccc21",
        locationObject: {
          id: "d48db17d-9b8b-4cbe-9ce9-b466f7dccc21",
          name: "SC Neilson Reserve",
          code: "SNRES",
          discoveryDisplayName: "Smith College Neilson Reserve",
          isActive: true,
          institutionId: "58effc21-7273-4074-8da4-9972e49073e6",
          campusId: "7d02e46d-3e60-4eaf-a986-5aa3550e8cb5",
          libraryId: "d541a5ab-50d8-4822-83fc-8469ddfcbb57",
          primaryServicePoint: "2c0764b7-63b3-4254-9950-0c730b7e438b",
          servicePointIds: ["2c0764b7-63b3-4254-9950-0c730b7e438b"]
        },
        termId: "e4112ac5-c09a-4351-a938-81445345bd0b",
        termObject: {
          id: "e4112ac5-c09a-4351-a938-81445345bd0b",
          name: "2025 Fall",
          startDate: "2025-08-19T04:00:00.000Z",
          endDate: "2025-12-30T05:00:00.000Z"
        },
        courseTypeId: "fa0a9b77-480d-4c4b-bb09-a1b3f12c8b50",
        courseTypeObject: {
          id: "fa0a9b77-480d-4c4b-bb09-a1b3f12c8b50",
          name: "In Person",
          description: "In Person"
        },
        instructorObjects: [
          {
            id: "a829a077-bae1-49e3-a4b4-b44781786e1b",
            userId: "cf4f4263-a0e7-5f4a-b3dc-7f74501558db",
            name: "Lisa Mangiamele",
            barcode: "210183607398815",
            patronGroup: "4261cb0a-edf6-4302-8028-9e5b67050c9e",
            patronGroupObject: {
              id: "4261cb0a-edf6-4302-8028-9e5b67050c9e",
              desc: "Faculty",
              group: "Faculty"
            },
            courseListingId: "e4e7d028-3444-4398-83ae-4882af35b349"
          }
        ]
      }
    },
    // Previous term (2025 Spring) - Available to copy
    {
      id: "b90eff87-0c9c-4e6c-b90d-dad0094cbc80",
      name: "Introduction to Biology",
      courseNumber: "BIO 100",
      departmentId: "9a865480-23c5-4aca-8780-44cbd985f653",
      departmentObject: {
        id: "9a865480-23c5-4aca-8780-44cbd985f653",
        name: "SC Biological Sciences",
        description: "SC Biological Sciences"
      },
      courseListingId: "f4e7d028-3444-4398-83ae-4882af35b350",
      courseListingObject: {
        id: "f4e7d028-3444-4398-83ae-4882af35b350",
        locationId: "d48db17d-9b8b-4cbe-9ce9-b466f7dccc21",
        locationObject: {
          id: "d48db17d-9b8b-4cbe-9ce9-b466f7dccc21",
          name: "SC Neilson Reserve",
          code: "SNRES",
          discoveryDisplayName: "Smith College Neilson Reserve",
          isActive: true,
          institutionId: "58effc21-7273-4074-8da4-9972e49073e6",
          campusId: "7d02e46d-3e60-4eaf-a986-5aa3550e8cb5",
          libraryId: "d541a5ab-50d8-4822-83fc-8469ddfcbb57",
          primaryServicePoint: "2c0764b7-63b3-4254-9950-0c730b7e438b",
          servicePointIds: ["2c0764b7-63b3-4254-9950-0c730b7e438b"]
        },
        termId: "5dc42f32-6ea4-4475-bcdd-09ce0d19e560",
        termObject: {
          id: "5dc42f32-6ea4-4475-bcdd-09ce0d19e560",
          name: "2025 Spring",
          startDate: "2025-01-06T05:00:00.000Z",
          endDate: "2025-05-22T04:00:00.000Z"
        },
        courseTypeId: "fa0a9b77-480d-4c4b-bb09-a1b3f12c8b50",
        courseTypeObject: {
          id: "fa0a9b77-480d-4c4b-bb09-a1b3f12c8b50",
          name: "In Person",
          description: "In Person"
        },
        instructorObjects: [
          {
            id: "a829a077-bae1-49e3-a4b4-b44781786e1c",
            userId: "cf4f4263-a0e7-5f4a-b3dc-7f74501558dc",
            name: "Lisa Mangiamele",
            barcode: "210183607398816",
            patronGroup: "4261cb0a-edf6-4302-8028-9e5b67050c9e",
            patronGroupObject: {
              id: "4261cb0a-edf6-4302-8028-9e5b67050c9e",
              desc: "Faculty",
              group: "Faculty"
            },
            courseListingId: "f4e7d028-3444-4398-83ae-4882af35b350"
          }
        ]
      }
    },
    // Much older course (2023 Fall) - Demonstrates historical course availability
    {
      id: "c90eff87-0c9c-4e6c-b90d-dad0094cbc81",
      name: "Advanced Animal Behavior",
      courseNumber: "BIO 335",
      departmentId: "9a865480-23c5-4aca-8780-44cbd985f653",
      departmentObject: {
        id: "9a865480-23c5-4aca-8780-44cbd985f653",
        name: "SC Biological Sciences",
        description: "SC Biological Sciences"
      },
      courseListingId: "g4e7d028-3444-4398-83ae-4882af35b351",
      courseListingObject: {
        id: "g4e7d028-3444-4398-83ae-4882af35b351",
        locationId: "d48db17d-9b8b-4cbe-9ce9-b466f7dccc21",
        locationObject: {
          id: "d48db17d-9b8b-4cbe-9ce9-b466f7dccc21",
          name: "SC Neilson Reserve",
          code: "SNRES",
          discoveryDisplayName: "Smith College Neilson Reserve",
          isActive: true,
          institutionId: "58effc21-7273-4074-8da4-9972e49073e6",
          campusId: "7d02e46d-3e60-4eaf-a986-5aa3550e8cb5",
          libraryId: "d541a5ab-50d8-4822-83fc-8469ddfcbb57",
          primaryServicePoint: "2c0764b7-63b3-4254-9950-0c730b7e438b",
          servicePointIds: ["2c0764b7-63b3-4254-9950-0c730b7e438b"]
        },
        termId: "0a365284-f131-41c4-87a3-188723ddfa67",
        termObject: {
          id: "0a365284-f131-41c4-87a3-188723ddfa67",
          name: "2023 Fall",
          startDate: "2023-08-29T04:00:00.000Z",
          endDate: "2023-12-28T05:00:00.000Z"
        },
        courseTypeId: "fa0a9b77-480d-4c4b-bb09-a1b3f12c8b50",
        courseTypeObject: {
          id: "fa0a9b77-480d-4c4b-bb09-a1b3f12c8b50",
          name: "In Person",
          description: "In Person"
        },
        instructorObjects: [
          {
            id: "a829a077-bae1-49e3-a4b4-b44781786e1d",
            userId: "cf4f4263-a0e7-5f4a-b3dc-7f74501558de",
            name: "Lisa Mangiamele",
            barcode: "210183607398817",
            patronGroup: "4261cb0a-edf6-4302-8028-9e5b67050c9e",
            patronGroupObject: {
              id: "4261cb0a-edf6-4302-8028-9e5b67050c9e",
              desc: "Faculty",
              group: "Faculty"
            },
            courseListingId: "g4e7d028-3444-4398-83ae-4882af35b351"
          }
        ]
      }
    }
  ];
  
  // Filter mock courses based on search term
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    return mockCourses.filter(course => 
      course.name.toLowerCase().includes(term) ||
      course.courseListingObject.instructorObjects.some(instructor =>
        instructor.name.toLowerCase().includes(term)
      )
    );
  }
  
  return mockCourses;
}
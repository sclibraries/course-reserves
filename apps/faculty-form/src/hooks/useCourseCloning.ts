import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/config/endpoints';
import { fetchMergedCourseResources, fetchPhysicalCourseResources } from '@/services/courseResourceFetch';

export interface PreviousCourse {
  courseListingId: string;
  courseNumber: string;
  courseName: string;
  term: string;
  instructor: string;
  resourceCount: number;
  electronicCount: number;
  physicalCount: number;
  isExactMatch: boolean;
}

export interface PhysicalReserve {
  temporaryItemId: string;
  barcode?: string;
  callNumber?: string;
  copiedItem?: {
    title?: string;
    contributors?: Array<{ name: string; primary?: boolean }>;
    publication?: Array<{ publisher?: string; dateOfPublication?: string }>;
    callNumber?: string;
    barcode?: string;
  };
  item?: {
    title?: string;
    contributors?: Array<{ name: string; primary?: boolean }>;
    publication?: Array<{ publisher?: string; dateOfPublication?: string }>;
    effectiveCallNumberComponents?: { callNumber?: string };
    barcode?: string;
  };
}

export interface ElectronicResource {
  id: string;
  title?: string;
  authors?: string;
  url?: string;
  item_url?: string;
  publication_title?: string;
  publication_date?: string;
  notes?: string;
  description?: string;
  external_note?: string;
  internal_note?: string;
  folder_name?: string;
  resource_type?: string;
  order?: string | number;
}

export interface PreviewResource {
  type: 'physical' | 'electronic' | string;
  title: string;
  author?: string;
  materialType: string;
  publicationInfo?: string;
  callNumber?: string;
  url?: string;
  notes?: string;
  order?: number; // Preserve display order from backend
  discoveryUrl?: string; // URL to view physical item in discovery interface
  description?: string; // Rich description from electronic resources
  _originalReserve?: PhysicalReserve;
  _originalResource?: ElectronicResource;
  folderName?: string;
  folderId?: string;
}

export const useCourseCloning = () => {
  const [loadingPreviousCourses, setLoadingPreviousCourses] = useState(false);
  const [hasLoadedPreviousCourses, setHasLoadedPreviousCourses] = useState(false);
  const [loadingOtherCourses, setLoadingOtherCourses] = useState(false);
  const [previousCourses, setPreviousCourses] = useState<PreviousCourse[]>([]);
  const [cloningFromCourse, setCloningFromCourse] = useState<string | null>(null);
  const previousCoursesRequestId = useRef(0);

  const loadPreviousCoursesByMode = useCallback(async (
    courseCode: string,
    instructorName: string,
    mode: 'exact' | 'all'
  ) => {
    const firstName = instructorName.split(' ')[0];

    let query: string;

    if (mode === 'exact') {
      query = `(courseNumber=="${courseCode}" and department.name=="SC*" and courseListing.instructorObjects="${firstName}*") sortby courseListing.termObject.name/sort.descending`;
    } else {
      query = `(department.name=="SC*" and courseListing.instructorObjects="${firstName}*") sortby name`;
    }
    const searchUrl = `${API_ENDPOINTS.FOLIO.BASE_URL}${API_ENDPOINTS.FOLIO.SEARCH_COURSES}?query=${encodeURIComponent(query)}`;

    const coursesRes = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      mode: 'cors',
      credentials: 'omit'
    });

    if (!coursesRes.ok) {
      throw new Error('Failed to fetch courses');
    }

    const coursesData = await coursesRes.json();
    const courses = coursesData.data?.courses || [];
    const coursesWithCounts = await Promise.all(
      courses.map(async (course: {
        courseListingObject?: { id?: string; termObject?: { name?: string }; instructorObjects?: Array<{ name?: string }>; };
        courseListingId?: string;
        courseNumber?: string;
        name?: string;
      }) => {
        try {
          const courseListingId = course.courseListingObject?.id || course.courseListingId;

          let electronicCount = 0;
          let physicalCount = 0;

          try {
            const electronicRes = await fetchMergedCourseResources(courseListingId);

            if (electronicRes.ok) {
              const electronicData = await electronicRes.json();
              const resources = electronicData.resources || [];
              electronicCount = resources.filter((r: { resource_type?: string }) => r.resource_type === 'electronic').length;
            }
          } catch (error) {
            console.log('Electronic resources fetch failed:', error);
          }

          try {
            const physicalRes = await fetchPhysicalCourseResources(courseListingId);

            if (physicalRes.ok) {
              const physicalData = await physicalRes.json();
              const reserves = physicalData.data?.reserves || physicalData.reserves || [];
              physicalCount = reserves.length;
            }
          } catch (error) {
            console.log('Physical reserves fetch failed:', error);
          }

          const normalizedCourseNumber = course.courseNumber || '';

          return {
            courseListingId,
            courseNumber: normalizedCourseNumber,
            courseName: course.name || 'Unknown Course',
            term: course.courseListingObject?.termObject?.name || 'Unknown Term',
            instructor: course.courseListingObject?.instructorObjects?.[0]?.name || instructorName,
            resourceCount: electronicCount + physicalCount,
            electronicCount,
            physicalCount,
            isExactMatch: normalizedCourseNumber === courseCode,
          };
        } catch (error) {
          console.error('Failed to process course:', error);
          return null;
        }
      })
    );

    return coursesWithCounts
      .filter((course): course is PreviousCourse => course !== null)
      .sort((a, b) => {
        if (a.isExactMatch && !b.isExactMatch) return -1;
        if (!a.isExactMatch && b.isExactMatch) return 1;
        return b.term.localeCompare(a.term);
      });
  }, []);

  const fetchPreviousCourses = useCallback(async (
    courseCode: string,
    instructorName: string,
    mode: 'exact' | 'all' = 'exact'
  ) => {
    const requestId = ++previousCoursesRequestId.current;

    setPreviousCourses([]);
    setHasLoadedPreviousCourses(false);
    setLoadingPreviousCourses(true);
    setLoadingOtherCourses(false);

    try {
      const exactCourses = await loadPreviousCoursesByMode(courseCode, instructorName, 'exact');

      if (requestId !== previousCoursesRequestId.current) {
        return exactCourses;
      }

      setPreviousCourses(exactCourses);
      setLoadingPreviousCourses(false);
      setHasLoadedPreviousCourses(true);

      if (mode === 'exact') {
        return exactCourses;
      }

      setLoadingOtherCourses(true);

      try {
        const allCourses = await loadPreviousCoursesByMode(courseCode, instructorName, 'all');

        if (requestId !== previousCoursesRequestId.current) {
          return exactCourses;
        }

        const exactCourseIds = new Set(exactCourses.map((course) => course.courseListingId));
        const mergedCourses = [
          ...exactCourses,
          ...allCourses.filter((course) => !exactCourseIds.has(course.courseListingId)),
        ];

        setPreviousCourses(mergedCourses);
        return mergedCourses;
      } catch (error) {
        if (requestId === previousCoursesRequestId.current) {
          console.error('Failed to load other courses:', error);
          toast.error('Failed to load other courses');
        }

        return exactCourses;
      } finally {
        if (requestId === previousCoursesRequestId.current) {
          setLoadingOtherCourses(false);
        }
      }
    } catch (error) {
      console.error('Failed to load previous courses:', error);
      toast.error('Failed to load previous courses');

      if (requestId === previousCoursesRequestId.current) {
        setPreviousCourses([]);
        setLoadingPreviousCourses(false);
        setHasLoadedPreviousCourses(true);
        setLoadingOtherCourses(false);
      }

      return [];
    }
  }, [loadPreviousCoursesByMode]);

  const fetchCourseResources = useCallback(async (courseListingId: string) => {
    try {
      let physicalReserves: PhysicalReserve[] = [];
      let electronicResources: ElectronicResource[] = [];
      let orderedResources: Record<string, unknown>[] = [];
      
      try {
        const mergedRes = await fetchMergedCourseResources(courseListingId);
        
        if (mergedRes.ok) {
          const mergedData = await mergedRes.json();
          const resources = mergedData.resources || [];
          orderedResources = resources;
          
          electronicResources = resources
            .filter((r: { resource_type?: string }) => r.resource_type === 'electronic')
            .map((r: { order?: string | number; [key: string]: unknown }) => ({
              ...r,
              order: r.order ? (typeof r.order === 'string' ? parseInt(r.order, 10) : r.order) : 999999,
            } as ElectronicResource));
        }
      } catch (error) {
        console.error('Failed to fetch merged resources:', error);
      }
      
      // Fetch physical reserves with full FOLIO data
      try {
        const physicalRes = await fetchPhysicalCourseResources(courseListingId);
        
        if (physicalRes.ok) {
          const physicalData = await physicalRes.json();
          physicalReserves = physicalData.data?.reserves || physicalData.reserves || [];
        }
      } catch (error) {
        console.log('Physical reserves unavailable:', error);
      }
      
      return { physicalReserves, electronicResources, orderedResources };
    } catch (error) {
      console.error('Failed to fetch course resources:', error);
      return { physicalReserves: [], electronicResources: [], orderedResources: [] };
    }
  }, []);
  return {
    loadingPreviousCourses,
    hasLoadedPreviousCourses,
    loadingOtherCourses,
    previousCourses,
    cloningFromCourse,
    setCloningFromCourse,
    fetchPreviousCourses,
    fetchCourseResources,
  };
};

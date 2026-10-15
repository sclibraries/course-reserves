import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCourseSearchStore, type Course } from '@/store/courseSearchStore';
import { useAuthStore } from '@/store/authStore';
import { useTermsStore } from '@/store/termsStore';
import { useCourseReservesStore } from '@/store/courseReservesStore';
import { fetchMergedCourseResources, fetchPhysicalCourseResources } from '@/services/courseResourceFetch';
import { formatCourseDisplay, groupCoursesByTerm } from '@/pages/clonePrevious/courseGrouping';
import { mapResourcesForClone, mapResourcesForPreview } from '@/pages/clonePrevious/mappers';
import type { CourseResource, ElectronicResource, PhysicalReserve } from '@/pages/clonePrevious/types';

export const useClonePrevious = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [cloningCourse, setCloningCourse] = useState<string | null>(null);
  const [courseResources, setCourseResources] = useState<CourseResource[]>([]);
  const [resourceCounts, setResourceCounts] = useState<Record<string, number | 'loading'>>({});
  const { loading, courses, searchCoursesByInstructor } = useCourseSearchStore();
  const { user, isAuthenticated } = useAuthStore();
  const { getNextTermName, getCurrentTermName } = useTermsStore();
  const { addReserve } = useCourseReservesStore();

  const fetchPhysicalReserves = useCallback(async (courseListingId: string): Promise<PhysicalReserve[]> => {
    try {
      const response = await fetchPhysicalCourseResources(courseListingId);
      if (!response.ok) {
        throw new Error(`Physical reserves API error: ${response.status} ${response.statusText}`);
      }
      const results = await response.json();
      return results.data?.reserves || [];
    } catch (error) {
      console.error('Failed to fetch physical reserves:', error);
      return [];
    }
  }, []);

  const fetchElectronicResources = useCallback(async (courseListingId: string): Promise<ElectronicResource[]> => {
    try {
      const response = await fetchMergedCourseResources(courseListingId);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Electronic resources API error: ${response.status} ${response.statusText}`);
      }
      const json = await response.json();
      return json.resources || [];
    } catch (error) {
      console.warn('Failed to fetch electronic resources:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.full_name) searchCoursesByInstructor(user.full_name);
  }, [isAuthenticated, user?.full_name, searchCoursesByInstructor]);

  useEffect(() => {
    const loadResourceCounts = async () => {
      if (courses.length === 0) return;
      const loadingState = courses.reduce((counts, course) => {
        counts[course.courseListingId] = 'loading';
        return counts;
      }, {} as Record<string, 'loading'>);
      setResourceCounts(loadingState);

      const results = await Promise.allSettled(courses.map(async (course) => {
        const [physicalReserves, electronicResources] = await Promise.all([
          fetchPhysicalReserves(course.courseListingId),
          fetchElectronicResources(course.courseListingId),
        ]);
        return {
          courseListingId: course.courseListingId,
          count: physicalReserves.length + electronicResources.length,
        };
      }));
      const newCounts: Record<string, number> = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') newCounts[result.value.courseListingId] = result.value.count;
        else newCounts[courses[index].courseListingId] = 0;
      });
      setResourceCounts(newCounts);
    };

    loadResourceCounts();
  }, [courses, fetchPhysicalReserves, fetchElectronicResources]);

  const handleCloneCourse = useCallback(async (course: Course) => {
    setCloningCourse(course.id);
    try {
      console.log('Cloning course:', course);
      const [physicalReserves, electronicResources] = await Promise.all([
        fetchPhysicalReserves(course.courseListingId),
        fetchElectronicResources(course.courseListingId),
      ]);
      const clonedItems = mapResourcesForClone(physicalReserves, electronicResources);
      const nextTerm = getNextTermName() || getCurrentTermName() || '2025 Spring';
      const newReserveId = addReserve({
        courseCode: course.courseNumber || course.name || 'Unknown Course',
        courseTitle: course.name || 'Unknown Course',
        section: '01',
        instructors: course.courseListingObject?.instructorObjects?.[0]?.name || user?.full_name || 'Unknown Instructor',
        term: nextTerm,
        status: 'draft',
        items: clonedItems,
      } as Parameters<typeof addReserve>[0]);
      setPreviewOpen(false);
      toast.success(`Successfully cloned ${clonedItems.length} resources from ${course.courseNumber || course.name}`);
      navigate(`/submission/${newReserveId}/edit`);
    } catch (error) {
      console.error('Failed to clone course:', error);
      toast.error('Failed to clone course. Please try again.');
    } finally {
      setCloningCourse(null);
    }
  }, [addReserve, fetchPhysicalReserves, fetchElectronicResources, getNextTermName, getCurrentTermName, user?.full_name, navigate]);

  const handlePreviewCourse = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setPreviewOpen(true);
    setLoadingResources(true);
    try {
      console.log('Fetching resources for course listing ID:', course.courseListingId);
      const [physicalReserves, electronicResources] = await Promise.all([
        fetchPhysicalReserves(course.courseListingId),
        fetchElectronicResources(course.courseListingId),
      ]);
      console.log('Physical reserves:', physicalReserves.length);
      console.log('Electronic resources:', electronicResources.length);
      const resources = mapResourcesForPreview(physicalReserves, electronicResources);
      console.log('Total processed resources:', resources.length);
      setCourseResources(resources);
    } catch (error) {
      console.error('Failed to load course resources:', error);
      setCourseResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, [fetchPhysicalReserves, fetchElectronicResources]);

  const filteredCourses = courses.filter((course) => {
    if (!searchQuery.trim()) return true;
    return (course.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
  });
  const courseGroups = groupCoursesByTerm(filteredCourses, resourceCounts);
  const selectedCourseDisplay = selectedCourse
    ? formatCourseDisplay(selectedCourse, resourceCounts)
    : null;

  return {
    isAuthenticated,
    loading,
    courses,
    searchQuery,
    setSearchQuery,
    clearSearch: () => setSearchQuery(''),
    courseGroups,
    nextTerm: getNextTermName() || getCurrentTermName() || 'next term',
    previewOpen,
    setPreviewOpen,
    selectedCourse,
    selectedCourseDisplay,
    loadingResources,
    courseResources,
    cloningCourse,
    handlePreviewCourse,
    handleCloneCourse,
  };
};

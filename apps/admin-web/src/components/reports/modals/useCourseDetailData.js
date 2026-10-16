import { useCallback, useEffect, useState } from 'react';
import { config } from '../../../config';
import { authFetch } from '../../../services/http/authFetch';

export function useCourseDetailData(isOpen, course) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [courseData, setCourseData] = useState(null);

  const fetchCourseDetail = useCallback(async () => {
    if (!course?.name) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ 'course-name': course.name });
      if (course.college) params.append('college', course.college);

      const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}/course-detail?${params}`;
      const response = await authFetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText || 'No error details'}`);
      }

      setCourseData(await response.json());
    } catch (err) {
      console.error('Error fetching course detail:', err);
      setError(err.message || 'Failed to fetch course details');
    } finally {
      setLoading(false);
    }
  }, [course]);

  useEffect(() => {
    if (isOpen && course) fetchCourseDetail();
  }, [isOpen, course, fetchCourseDetail]);

  useEffect(() => {
    if (!isOpen) {
      setCourseData(null);
      setError(null);
    }
  }, [isOpen]);

  return { loading, error, courseData, fetchCourseDetail };
}

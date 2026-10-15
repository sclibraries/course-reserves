import type { Course } from '@/store/courseSearchStore';
import type { CourseTermGroup, DisplayCourse } from './types';

export const formatCourseDisplay = (
  course: Course,
  resourceCounts: Record<string, number | 'loading'>
): DisplayCourse => {
  const instructors = course.courseListingObject?.instructorObjects || [];
  return {
    id: course.id,
    courseNumber: course.courseNumber || 'N/A',
    courseTitle: course.name || 'Unknown Course',
    departmentName: course.departmentObject?.name || 'Unknown Department',
    instructor: instructors.length > 0
      ? instructors.map((instructor) => instructor.name).join(', ')
      : 'Unknown Instructor',
    term: course.courseListingObject?.termObject?.name || 'Unknown Term',
    resourceCount: resourceCounts[course.courseListingId] ?? 'loading',
    courseListingId: course.courseListingId,
  };
};

export const groupCoursesByTerm = (
  courses: Course[],
  resourceCounts: Record<string, number | 'loading'>
): CourseTermGroup[] => {
  const grouped = courses.reduce((groups, course) => {
    const displayCourse = formatCourseDisplay(course, resourceCounts);
    const term = displayCourse.term;
    if (!groups[term]) groups[term] = [];
    groups[term].push({ course, displayCourse });
    return groups;
  }, {} as Record<string, CourseTermGroup['courses']>);

  return Object.entries(grouped).sort(([termA], [termB]) => {
    const year = (term: string) => {
      const match = term.match(/(\d{4})/);
      return match ? parseInt(match[1]) : 0;
    };
    const yearA = year(termA);
    const yearB = year(termB);
    if (yearA !== yearB) return yearB - yearA;

    const seasonOrder = { Fall: 4, Summer: 3, Spring: 2, Winter: 1 };
    const season = (term: string) => Object.entries(seasonOrder).find(([name]) => (
      term.toLowerCase().includes(name.toLowerCase())
    ))?.[1] || 0;
    return season(termB) - season(termA);
  }).map(([term, groupedCourses]) => ({ term, courses: groupedCourses }));
};

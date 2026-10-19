import type { PreviousCourse } from './useCourseCloning';

export interface FolioPreviousCourse {
  courseListingObject?: {
    id?: string;
    termObject?: { name?: string };
    instructorObjects?: Array<{ name?: string }>;
  };
  courseListingId?: string;
  courseNumber?: string;
  name?: string;
}

export type PreviousCourseSearchMode = 'exact' | 'all';

export function buildPreviousCoursesQuery(
  courseCode: string,
  instructorName: string,
  mode: PreviousCourseSearchMode,
): string {
  const escapedCourseCode = escapeCqlValue(courseCode);
  const escapedInstructorName = escapeCqlValue(instructorName);
  const instructorClause = `courseListing.instructorObjects="${escapedInstructorName}"`;

  if (mode === 'exact') {
    return `(courseNumber=="${escapedCourseCode}" and department.name=="SC*" and ${instructorClause}) sortby courseListing.termObject.name/sort.descending`;
  }

  return `(department.name=="SC*" and ${instructorClause}) sortby name`;
}

export function mapFolioCourseToPreviousCourse(
  course: FolioPreviousCourse,
  courseCode: string,
  instructorName: string,
): PreviousCourse | null {
  const instructor = course.courseListingObject?.instructorObjects?.find((candidate) => (
    candidate.name && normalizeInstructorName(candidate.name) === normalizeInstructorName(instructorName)
  ));
  const courseListingId = course.courseListingObject?.id || course.courseListingId;

  if (!instructor?.name || !courseListingId) return null;

  const courseNumber = course.courseNumber || '';
  return {
    courseListingId,
    courseNumber,
    courseName: course.name || 'Unknown Course',
    term: course.courseListingObject?.termObject?.name || 'Unknown Term',
    instructor: instructor.name,
    resourceCount: 0,
    electronicCount: 0,
    physicalCount: 0,
    isExactMatch: courseNumber === courseCode,
  };
}

function normalizeInstructorName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function escapeCqlValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

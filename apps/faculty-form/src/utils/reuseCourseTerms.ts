import type { PreviousCourse } from '@/hooks/useCourseCloning';
import { compareTermNames, parseTermName } from '@/lib/termUtils';

export function filterPreviousCoursesForSubmission(
  courses: PreviousCourse[],
  submissionTerm: string,
  submissionCourseNumber: string,
  submissionCourseListingId?: string,
): PreviousCourse[] {
  const normalizedCourseNumber = normalizeLabel(submissionCourseNumber);
  const normalizedSubmissionTerm = normalizeLabel(submissionTerm);

  return courses.filter((course) => {
    if (submissionCourseListingId && course.courseListingId === submissionCourseListingId) return false;

    const comparison = compareTermNames(course.term, submissionTerm);
    if (comparison !== null) return comparison < 0;

    if (parseTermName(course.term)) return false;
    const isCurrentCourseNumber = normalizeLabel(course.courseNumber) === normalizedCourseNumber;
    const isCurrentTermLabel = normalizeLabel(course.term) === normalizedSubmissionTerm;
    return !(isCurrentCourseNumber && isCurrentTermLabel);
  });
}

export function sortPreviousCourses(courses: PreviousCourse[]): PreviousCourse[] {
  return [...courses].sort((left, right) => {
    const leftTerm = parseTermName(left.term);
    const rightTerm = parseTermName(right.term);
    if (Boolean(leftTerm) !== Boolean(rightTerm)) return leftTerm ? -1 : 1;
    if (left.isExactMatch !== right.isExactMatch) return left.isExactMatch ? -1 : 1;
    if (leftTerm && rightTerm) return compareTermNames(right.term, left.term) || 0;
    return left.term.localeCompare(right.term);
  });
}

export function getPinnedPreviousCourse(courses: PreviousCourse[]): PreviousCourse | null {
  return courses
    .filter((course) => course.isExactMatch && parseTermName(course.term))
    .sort((left, right) => compareTermNames(right.term, left.term) || 0)[0] || null;
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

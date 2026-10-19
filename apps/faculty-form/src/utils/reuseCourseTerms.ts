import type { PreviousCourse } from '@/hooks/useCourseCloning';

export interface ParsedReuseTerm {
  year: number;
  rank: number;
}

const TERM_RANKS: Array<{ pattern: RegExp; rank: number }> = [
  { pattern: /\b(?:january|jan|interterm|winter)\b/i, rank: 0 },
  { pattern: /\bspring\b/i, rank: 1 },
  { pattern: /\bsummer\b/i, rank: 2 },
  { pattern: /\bfall\b/i, rank: 3 },
];

export function parseReuseTerm(term: string): ParsedReuseTerm | null {
  const year = term.match(/\b(\d{4})\b/)?.[1];
  const season = TERM_RANKS.find(({ pattern }) => pattern.test(term));
  if (!year || !season) return null;
  return { year: Number(year), rank: season.rank };
}

export function compareReuseTerms(left: string, right: string): number | null {
  const leftTerm = parseReuseTerm(left);
  const rightTerm = parseReuseTerm(right);
  if (!leftTerm || !rightTerm) return null;
  return leftTerm.year - rightTerm.year || leftTerm.rank - rightTerm.rank;
}

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

    const comparison = compareReuseTerms(course.term, submissionTerm);
    if (comparison !== null) return comparison < 0;

    if (parseReuseTerm(course.term)) return false;
    const isCurrentCourseNumber = normalizeLabel(course.courseNumber) === normalizedCourseNumber;
    const isCurrentTermLabel = normalizeLabel(course.term) === normalizedSubmissionTerm;
    return !(isCurrentCourseNumber && isCurrentTermLabel);
  });
}

export function sortPreviousCourses(courses: PreviousCourse[]): PreviousCourse[] {
  return [...courses].sort((left, right) => {
    const leftTerm = parseReuseTerm(left.term);
    const rightTerm = parseReuseTerm(right.term);
    if (Boolean(leftTerm) !== Boolean(rightTerm)) return leftTerm ? -1 : 1;
    if (left.isExactMatch !== right.isExactMatch) return left.isExactMatch ? -1 : 1;
    if (leftTerm && rightTerm) return compareReuseTerms(right.term, left.term) || 0;
    return left.term.localeCompare(right.term);
  });
}

export function getPinnedPreviousCourse(courses: PreviousCourse[]): PreviousCourse | null {
  return courses
    .filter((course) => course.isExactMatch && parseReuseTerm(course.term))
    .sort((left, right) => compareReuseTerms(right.term, left.term) || 0)[0] || null;
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

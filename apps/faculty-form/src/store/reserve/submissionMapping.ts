import { mapFacultySubmissionItems, type FacultySubmissionWire } from './facultyItemMapping';
import type { CourseReserve } from './types';

export type BackendSubmission = FacultySubmissionWire;

const formatLastUpdated = (updatedAt: string) => new Date(updatedAt).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const mapSubmission = (submission: BackendSubmission): CourseReserve => {
  const { folders, items, layout } = mapFacultySubmissionItems(
    submission.folders,
    submission.unfoldered_items,
  );
  const isLocked = submission.is_locked || !!submission.locked_by_staff_id;

  return {
    id: submission.submission_uuid,
    submissionUuid: submission.submission_uuid,
    courseCode: submission.course_code,
    courseTitle: submission.course_title,
    section: submission.section || '',
    instructors: submission.faculty_display_name,
    term: submission.term_code,
    status: submission.status as CourseReserve['status'],
    items,
    folders,
    layout,
    lastUpdated: formatLastUpdated(submission.updated_at),
    isTestData: false,
    ...(submission.its_course_id ? { courseAssignmentId: submission.its_course_id } : {}),
    ...(submission.academic_period ? { academicPeriod: submission.academic_period } : {}),
    ...(typeof submission.draft_version === 'number' ? { draftVersion: submission.draft_version } : {}),
    assigneeStaffUserId: null,
    isLocked: !!isLocked,
    lockedAt: submission.locked_at || null,
    lockedBy: submission.locked_by_staff_id === null || submission.locked_by_staff_id === undefined
      ? null
      : String(submission.locked_by_staff_id),
    lockReason: submission.lock_reason || null,
    canEdit: submission.can_edit && (submission.proxy_can_edit ?? true),
    ...(submission.access ? { access: submission.access } : {}),
    ...(typeof submission.proxy_can_edit === 'boolean'
      ? { proxyCanEdit: submission.proxy_can_edit }
      : {}),
    submissionNotes: submission.submission_notes ?? null,
    neededByDate: submission.needed_by_date ?? null,
  };
};

export const mapSubmissionIndexItem = (submission: BackendSubmission): CourseReserve => {
  const reserve = mapSubmission(submission);
  const legacyCourseAssignmentId = submission.section
    ? `${submission.course_code}-${submission.section}-${submission.term_code}`
    : submission.course_code;

  return {
    ...reserve,
    courseAssignmentId: submission.its_course_id || legacyCourseAssignmentId,
  };
};

export const mapSubmissionDetailItem = mapSubmission;

import type { CourseReserve } from '@/store/courseReservesStore';

type RosterCourse = Pick<CourseReserve, 'courseAssignmentId' | 'academicPeriod'>;

export const withRosterCourse = <T extends Record<string, unknown>>(
  payload: T,
  reserve: RosterCourse,
): T & { its_course_id?: string; academic_period?: string } => ({
  ...payload,
  ...(reserve.courseAssignmentId ? { its_course_id: reserve.courseAssignmentId } : {}),
  ...(reserve.academicPeriod ? { academic_period: reserve.academicPeriod } : {}),
});

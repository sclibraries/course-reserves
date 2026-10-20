import type { CourseReserve } from '@/store/courseReservesStore';

export function shouldSubmitAsDraft(
  reserve: Pick<CourseReserve, 'status' | 'submissionUuid' | 'items' | 'folders'>,
  hasUnsavedChanges: boolean,
): boolean {
  return reserve.status === 'draft' && (
    !!reserve.submissionUuid || hasUnsavedChanges || reserve.items.length > 0 || reserve.folders.length > 0
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { CourseReserve } from '@/store/courseReservesStore';

export interface LockInfo {
  lockedBy: string | null;
  lockedAt: string | null;
  lockReason: string | null;
}

/** Pure: a reserve is read-only when the backend locked it, said it is not
 * editable, or a 423 lock conflict was observed this session. */
export function isSubmissionReadOnly(
  reserve: CourseReserve | null | undefined,
  lockConflictDetected = false
): boolean {
  if (!reserve) return false;
  return reserve.isLocked === true || reserve.canEdit === false || lockConflictDetected === true;
}

export function getLockInfo(reserve: CourseReserve | null | undefined): LockInfo | null {
  if (!reserve) return null;
  return {
    lockedBy: reserve.lockedBy ?? null,
    lockedAt: reserve.lockedAt ?? null,
    lockReason: reserve.lockReason ?? null,
  };
}

export function useSubmissionLock(
  reserve: CourseReserve | null | undefined,
  options: { onRefocus?: () => void } = {}
) {
  const { onRefocus } = options;
  const [lockConflictDetected, setLockConflictDetected] = useState(false);

  const isReadOnly = isSubmissionReadOnly(reserve, lockConflictDetected);
  const lockInfo = isReadOnly ? getLockInfo(reserve) : null;

  const markLockConflict = useCallback(() => setLockConflictDetected(true), []);

  useEffect(() => {
    if (!onRefocus) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') onRefocus();
    };
    window.addEventListener('focus', onRefocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onRefocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onRefocus]);

  return { isReadOnly, lockInfo, markLockConflict };
}

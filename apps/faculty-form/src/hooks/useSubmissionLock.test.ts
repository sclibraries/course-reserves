import { describe, expect, it } from 'vitest';
import { isSubmissionReadOnly, getLockInfo } from './useSubmissionLock';
import type { CourseReserve } from '@/store/courseReservesStore';

const make = (over: Partial<CourseReserve> = {}): CourseReserve =>
  ({ id: 's1', isLocked: false, canEdit: true, ...over } as unknown as CourseReserve);

describe('isSubmissionReadOnly', () => {
  it('is false for an editable, unlocked reserve', () => {
    expect(isSubmissionReadOnly(make())).toBe(false);
  });
  it('is true when isLocked', () => {
    expect(isSubmissionReadOnly(make({ isLocked: true }))).toBe(true);
  });
  it('is true when canEdit is false', () => {
    expect(isSubmissionReadOnly(make({ canEdit: false }))).toBe(true);
  });
  it('is true when a lock conflict was detected', () => {
    expect(isSubmissionReadOnly(make(), true)).toBe(true);
  });
  it('is false for a null reserve', () => {
    expect(isSubmissionReadOnly(null)).toBe(false);
  });
});

describe('getLockInfo', () => {
  it('returns null fields when absent', () => {
    expect(getLockInfo(make())).toEqual({ lockedBy: null, lockedAt: null, lockReason: null });
  });
  it('returns lock fields from the reserve', () => {
    const info = getLockInfo(make({ lockedBy: 'Jane', lockedAt: '2026-06-20', lockReason: 'Busy' }));
    expect(info).toEqual({ lockedBy: 'Jane', lockedAt: '2026-06-20', lockReason: 'Busy' });
  });
  it('returns null for a null reserve', () => {
    expect(getLockInfo(null)).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatSubmissionQueueDate } from './submissionQueueFormatters';

describe('submission queue date formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('uses singular and plural week labels', () => {
    expect(formatSubmissionQueueDate('2026-10-20T12:00:00Z')).toBe('1 week ago');
    expect(formatSubmissionQueueDate('2026-10-13T12:00:00Z')).toBe('2 weeks ago');
  });
});

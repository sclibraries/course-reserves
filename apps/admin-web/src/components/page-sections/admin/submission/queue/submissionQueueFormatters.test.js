import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatSubmissionQueueDate } from './submissionQueueFormatters';

describe('submission queue date formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('keeps relative labels for the last seven days', () => {
    expect(formatSubmissionQueueDate('2026-10-21T12:00:00Z')).toBe('6 days ago');
  });

  it('uses short dates and includes the year only outside the current year', () => {
    expect(formatSubmissionQueueDate('2026-04-29T12:00:00Z')).toBe('Apr 29');
    expect(formatSubmissionQueueDate('2025-04-29T12:00:00Z')).toBe('Apr 29, 2025');
  });

  it('does not describe future dates as elapsed time', () => {
    expect(formatSubmissionQueueDate('2026-10-28T12:00:00Z')).toBe('Oct 28');
  });
});

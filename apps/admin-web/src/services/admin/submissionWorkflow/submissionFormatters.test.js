import { describe, expect, it } from 'vitest';
import { formatSubmissionStatusLabel } from './submissionFormatters';

describe('submission status formatting', () => {
  it('labels drafts without changing the submitted status presentation', () => {
    expect(formatSubmissionStatusLabel('draft')).toBe('Draft');
    expect(formatSubmissionStatusLabel('submitted')).toBe('Submitted');
  });
});

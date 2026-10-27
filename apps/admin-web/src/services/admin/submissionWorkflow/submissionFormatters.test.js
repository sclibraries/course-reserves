import { describe, expect, it } from 'vitest';
import {
  formatSubmissionCommunicationSummary,
  formatSubmissionForDisplay,
  formatSubmissionStatusLabel,
} from './submissionFormatters';

describe('submission status formatting', () => {
  it('uses the staff queue labels for each submission status', () => {
    expect(['submitted', 'in_review', 'partially_complete', 'complete', 'draft', 'canceled']
      .map(formatSubmissionStatusLabel)).toEqual([
        'Submitted', 'In Review', 'Partially Complete', 'Complete', 'Draft', 'Canceled',
      ]);
    expect(formatSubmissionStatusLabel('in_progress')).toBe('In Progress');
  });

  it('falls back to the faculty username when the display name is empty', () => {
    const submission = {
      faculty_display_name: '',
      shibboleth_user_id: 'test-faculty-a',
      newResources: [],
      reuseResources: [],
      communications: [],
      submitted_at: '2026-10-20T12:00:00Z',
    };

    expect(formatSubmissionForDisplay(submission).facultyName).toBe('test-faculty-a');
  });

  it('formats message counts with singular and plural nouns', () => {
    expect(formatSubmissionCommunicationSummary(1, 1)).toBe('1 unread · 1 message');
    expect(formatSubmissionCommunicationSummary(2, 0)).toBe('0 unread · 2 messages');
  });
});

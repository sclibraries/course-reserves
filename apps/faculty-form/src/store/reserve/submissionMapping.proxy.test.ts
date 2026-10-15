import { describe, expect, it } from 'vitest';
import { mapSubmissionIndexItem } from './submissionMapping';

describe('proxy submission mapping', () => {
  it('preserves optional proxy access labels and uses proxy edit permission', () => {
    const submission = mapSubmissionIndexItem({
      submission_uuid: 'submission-test-1',
      course_code: 'BIO 101',
      course_title: 'Synthetic Biology',
      faculty_display_name: 'Test Faculty',
      term_code: '2026FA',
      status: 'draft',
      updated_at: '2026-08-01T12:00:00Z',
      access: 'proxy',
      proxy_can_edit: false,
    });

    expect(submission).toMatchObject({
      access: 'proxy',
      proxyCanEdit: false,
      canEdit: false,
    });
  });

  it('keeps the current mapping when the API has not added proxy fields yet', () => {
    const submission = mapSubmissionIndexItem({
      submission_uuid: 'submission-test-1',
      course_code: 'BIO 101',
      course_title: 'Synthetic Biology',
      faculty_display_name: 'Test Faculty',
      term_code: '2026FA',
      status: 'draft',
      updated_at: '2026-08-01T12:00:00Z',
    });

    expect(submission).not.toHaveProperty('access');
    expect(submission).not.toHaveProperty('proxyCanEdit');
  });
});

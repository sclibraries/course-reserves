import { describe, expect, it } from 'vitest';
import { mapSubmissionDetailItem } from './submissionMapping';

describe('EDS submission item mapping', () => {
  it('restores structured identifiers and EDS identity from resource_data', () => {
    const edsFields = {
      doi: '10.1000/synthetic',
      issn: '1234-5678',
      journalTitle: 'Synthetic Journal',
      volume: '12',
      issue: '3',
      eds: {
        dbId: 'synthetic-database',
        an: 'synthetic-an',
        plink: 'https://search.ebscohost.com/record/synthetic',
      },
    };
    const reserve = mapSubmissionDetailItem({
      submission_uuid: 'submission-cx028',
      course_code: 'TST 028',
      course_title: 'Synthetic EDS course',
      faculty_display_name: 'Test Faculty',
      term_code: 'Fall 2099',
      status: 'submitted',
      updated_at: '2099-08-01T12:00:00Z',
      unfoldered_items: [{
        id: 28,
        title: 'Synthetic Article',
        authors: 'Test Author',
        material_type: 'article',
        status: 'pending',
        display_order: 0,
        resource_data: edsFields,
      }],
    });

    expect(reserve.items).toHaveLength(1);
    expect(reserve.items[0]).toMatchObject(edsFields);
  });
});

import { describe, expect, it } from 'vitest';
import { mapSubmissionDetailItem } from './submissionMapping';
import type { FacultyItemWire } from './facultyItemMapping';

const facultyItem = (overrides: Partial<FacultyItemWire>): FacultyItemWire => ({
  kind: 'new',
  id: 28,
  folder_id: null,
  folder_name: null,
  position: null,
  display_order: 0,
  is_reuse: false,
  status: 'pending',
  title: 'Synthetic Article',
  journalTitle: 'Synthetic Journal',
  material_type: 'article',
  assignedPages: null,
  faculty_notes: null,
  barcode: null,
  call_number: null,
  eds: null,
  source_resource_id: null,
  source_folio_instance_id: null,
  instance_id: null,
  holdings_id: null,
  temporary_location: null,
  permanent_location: null,
  lock: { locked: false, kind: null, reason: null },
  capabilities: { edit: true, delete: true, move: true, reorder: true },
  authors: 'Test Author',
  publisher: null,
  publicationYear: null,
  isbn: null,
  issn: '1234-5678',
  doi: '10.1000/synthetic',
  edition: null,
  oclcNumber: null,
  volume: '12',
  issue: '3',
  pages: null,
  url: null,
  displayStartDate: null,
  displayEndDate: null,
  instance_hrid: null,
  chapter_title: null,
  copy: null,
  temporary_location_id: null,
  permanent_location_id: null,
  ...overrides,
});

describe('EDS submission item mapping', () => {
  it('preserves the canonical EDS plink from the faculty item representation', () => {
    const eds = {
      dbId: 'synthetic-database',
      an: 'synthetic-an',
      plink: 'https://search.ebscohost.com/record/synthetic',
    };
    const reserve = mapSubmissionDetailItem({
      submission_uuid: 'submission-cx028',
      course_code: 'TST 028',
      course_title: 'Synthetic EDS course',
      faculty_display_name: 'Test Faculty',
      term_code: 'Fall 2099',
      status: 'submitted',
      updated_at: '2099-08-01T12:00:00Z',
      can_edit: true,
      folders: [],
      unfoldered_items: [facultyItem({ eds })],
    });

    expect(reserve.items).toHaveLength(1);
    expect(reserve.items[0]).toMatchObject({
      doi: '10.1000/synthetic',
      issn: '1234-5678',
      journalTitle: 'Synthetic Journal',
      volume: '12',
      issue: '3',
      eds,
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { CourseItem, CourseReserve } from '@/store/courseReservesStore';
import { buildSubmissionPayload } from './submissionPayload';

describe('buildSubmissionPayload', () => {
  it('preserves structured EDS metadata for server draft payloads', () => {
    const eds = {
      dbId: 'synthetic-database',
      an: 'synthetic-an',
      plink: 'https://search.ebscohost.com/record/synthetic',
    };
    const item: CourseItem = {
      id: 'item-1',
      title: 'Synthetic Article',
      materialType: 'article',
      status: 'draft',
      issn: '1234-5678',
      eds,
    };
    const reserve: CourseReserve = {
      id: 'reserve-local',
      courseCode: 'ENG 101',
      courseTitle: 'Intro',
      section: '01',
      instructors: 'Test Faculty',
      term: '2027SP',
      status: 'draft',
      items: [item],
      folders: [],
      layout: [{ kind: 'item', id: item.id }],
      lastUpdated: 'Oct 20, 2026',
    };

    expect(buildSubmissionPayload(reserve).items[0]).toMatchObject({ issn: '1234-5678', eds });
  });
});

import { describe, expect, it } from 'vitest';
import {
  validateCourseInfo,
  validateReserveForSubmission,
  validateReserveItem,
} from './reserveValidation';

describe('validateCourseInfo', () => {
  it('requires usable course code and title values', () => {
    const result = validateCourseInfo({
      courseCode: '   ',
      courseTitle: 'Intro to Literature',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Course code is required.');
  });

  it('rejects course codes without both letters and numbers', () => {
    const result = validateCourseInfo({
      courseCode: 'INTRO',
      courseTitle: 'Intro to Literature',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Course code must include both letters and numbers.');
  });
});

describe('validateReserveItem', () => {
  it('requires item title and material type', () => {
    const result = validateReserveItem({
      title: '',
      materialType: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'Item title is required.',
      'Material type is required.',
    ]);
  });

  it('rejects malformed identifiers and URLs', () => {
    const result = validateReserveItem({
      title: 'Example Book',
      materialType: 'Book',
      isbn: '12345',
      doi: 'abc/123',
      sourceLink: 'ftp://example.test/resource',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('ISBN must be a valid 10 or 13 digit ISBN.');
    expect(result.errors).toContain('DOI must start with 10. and include a suffix.');
    expect(result.errors).toContain('URL must start with http:// or https://.');
  });

  it('rejects display windows where the end date is before the start date', () => {
    const result = validateReserveItem({
      title: 'Example Book',
      materialType: 'Book',
      displayStartDate: new Date('2026-09-10T00:00:00.000Z'),
      displayEndDate: new Date('2026-09-01T00:00:00.000Z'),
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Display end date must be on or after the start date.');
  });

  it('allows long catalog-style item titles', () => {
    const result = validateReserveItem({
      title:
        "Ender's game / directed by Gavin Hood ; screenplay by Gavin Hood ; produced by Gigi Pritzker, Linda McDonough, Alex Kurtzman, Roberto Orci ; produced by Robert Chartoff, Lynn Hendee, Orson Scott Card ; produced by Ed Ulbrich ; executive producers, Bill Lischak, David Coatsworth, Ivy Zhong ; executive producers, Venkatesh Roddam, Ted Ravinett, Deborah Del Prete, Mandy Safavi ; a Summit Entertainment presentation ; in association with OddLot Entertainment ; a Chartoff Productions, Taleswapper, Oddlot Entertainment, K/O Paper Products, Digital Domain production ; a Gavin Hood film.",
      materialType: 'Book',
    });

    expect(result.valid).toBe(true);
  });

  it('allows item titles longer than previous UI limits', () => {
    const result = validateReserveItem({
      title: 'A'.repeat(1026),
      materialType: 'Book',
    });

    expect(result.valid).toBe(true);
  });
});

describe('validateReserveForSubmission', () => {
  it('reports course and item errors before payload submission', () => {
    const result = validateReserveForSubmission({
      courseCode: 'ENG 101',
      courseTitle: 'Intro to Literature',
      items: [
        {
          title: '',
          materialType: 'book',
          status: 'draft',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Item 1: Item title is required.']);
  });

  it('includes item title context when reporting invalid item titles', () => {
    const result = validateReserveForSubmission({
      courseCode: 'ENG 101',
      courseTitle: 'Intro to Literature',
      items: [
        {
          title: 'Valid Book',
          materialType: 'book',
          status: 'draft',
        },
        {
          title: 'Bad\u0001Title',
          materialType: 'book',
          status: 'draft',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'Item 2 "Bad\u0001Title": Item title cannot contain control characters.',
    ]);
  });
});

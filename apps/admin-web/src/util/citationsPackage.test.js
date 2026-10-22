import { describe, expect, it } from 'vitest';
import { extractCitationsFromSyllabus } from '@course-reserves/citations';

describe('shared citations package', () => {
  it('extracts a citation through the package alias', () => {
    const citation = 'Test Author, "Package resolution test title," Example Journal 4 (2024): 1-2';

    expect(extractCitationsFromSyllabus(citation).citations).toEqual([citation]);
  });
});

import { describe, expect, it } from 'vitest';
import { citationToCourseItem } from './citationToCourseItem';

describe('citationToCourseItem', () => {
  it('keeps the full citation in notes while limiting long titles to 200 characters', () => {
    const citation = 'A. Author (2025). ' + 'A long synthetic citation title. '.repeat(12);
    const item = citationToCourseItem(citation);

    expect(item.title).toHaveLength(200);
    expect(item.title?.endsWith('...')).toBe(true);
    expect(item.notes).toBe(citation);
  });
});

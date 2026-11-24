import { describe, expect, it } from 'vitest';
import { groupSyllabusEntries } from './staffSyllabusRequestUtils';

describe('groupSyllabusEntries', () => {
  it('groups trimmed headings without case and keeps the first label and entry ids', () => {
    const groups = groupSyllabusEntries([
      { heading: '  Week 1 ', text: 'first' },
      { heading: 'week 1', text: 'second' },
      { heading: ' ', text: 'third' },
      { heading: 'syllabus items ', text: 'fourth' },
    ]);

    expect(groups.map(({ heading, entries }) => [heading, entries.map(({ id }) => id)])).toEqual([
      ['Week 1', ['syllabus-entry-1', 'syllabus-entry-2']],
      ['Syllabus items', ['syllabus-entry-3', 'syllabus-entry-4']],
    ]);
  });
});

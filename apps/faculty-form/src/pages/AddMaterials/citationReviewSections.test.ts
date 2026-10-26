import { describe, expect, it } from 'vitest';
import { groupCitationsByHeading } from './citationReviewSections';

describe('groupCitationsByHeading', () => {
  it('groups repeated headings, preserves first heading order, and leaves unheaded citations unlabeled', () => {
    expect(groupCitationsByHeading([
      { id: 'one', text: 'First citation', heading: 'Week 1' },
      { id: 'two', text: 'Unheaded citation', heading: null },
      { id: 'three', text: 'Another Week 1 citation', heading: 'Week 1' },
      { id: 'four', text: 'Week 2 citation', heading: 'Week 2' },
    ])).toEqual([
      { heading: 'Week 1', citations: [{ citation: { id: 'one', text: 'First citation', heading: 'Week 1' }, index: 0 }, { citation: { id: 'three', text: 'Another Week 1 citation', heading: 'Week 1' }, index: 2 }] },
      { heading: null, citations: [{ citation: { id: 'two', text: 'Unheaded citation', heading: null }, index: 1 }] },
      { heading: 'Week 2', citations: [{ citation: { id: 'four', text: 'Week 2 citation', heading: 'Week 2' }, index: 3 }] },
    ]);
  });
});

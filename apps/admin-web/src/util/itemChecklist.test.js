import { describe, expect, it } from 'vitest';
import {
  filterChecklistTemplates,
  getChecklistProgress,
  getRequiredTasksRemaining,
  getUniqueChecklistFormats,
  getUniqueChecklistMaterialTypes
} from './itemChecklist';

describe('item checklist calculations', () => {
  const templates = [
    { id: 1, name: 'Test Video', description: 'Stream', format: 'Video', material_types: ['Film'] },
    { id: 2, name: 'Test Book', description: 'Print', format: 'Book', material_types: ['Text'] }
  ];

  it('filters templates by search, format, and material type', () => {
    expect(filterChecklistTemplates(templates, 'stream', 'all', 'all')).toEqual([templates[0]]);
    expect(filterChecklistTemplates(templates, '', 'Book', 'all')).toEqual([templates[1]]);
    expect(filterChecklistTemplates(templates, '', 'all', 'Text')).toEqual([templates[1]]);
  });

  it('returns sorted unique format and material type options', () => {
    expect(getUniqueChecklistFormats(templates)).toEqual(['Book', 'Video']);
    expect(getUniqueChecklistMaterialTypes(templates)).toEqual(['Film', 'Text']);
  });

  it('calculates progress and remaining required tasks', () => {
    const tasks = [
      { completed: true, optional: false },
      { completed: false, optional: false },
      { completed: false, optional: true }
    ];
    expect(getChecklistProgress(tasks)).toBe(33);
    expect(getRequiredTasksRemaining(tasks)).toBe(1);
    expect(getChecklistProgress([])).toBe(0);
    expect(getRequiredTasksRemaining(null)).toBe(0);
  });
});

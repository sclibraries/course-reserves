import { describe, expect, it } from 'vitest';
import { transformItemForEditing, transformItemForSaving } from './itemTransformers';

describe('item transformers', () => {
  it('round-trips legacy attachment metadata with editable bibliographic fields', () => {
    const editedItem = transformItemForEditing({
      id: 'legacy-item',
      materialType: 'article',
      title: 'Legacy article',
      authors: 'Legacy author',
      url: 'https://example.test/article',
      notes: 'Staff note',
      journalTitle: 'Journal of Tests',
      hasAttachment: true,
      attachmentName: 'legacy.pdf',
      attachmentSize: 4096,
      attachmentType: 'application/pdf',
    });

    expect(transformItemForSaving(editedItem)).toMatchObject({
      title: 'Legacy article',
      authors: 'Legacy author',
      url: 'https://example.test/article',
      notes: 'Staff note',
      journalTitle: 'Journal of Tests',
      hasAttachment: true,
      attachmentName: 'legacy.pdf',
      attachmentSize: 4096,
      attachmentType: 'application/pdf',
    });
  });
});

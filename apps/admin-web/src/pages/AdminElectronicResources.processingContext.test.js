import { describe, expect, it } from 'vitest';
import { getProcessingContextFromLocation } from './AdminElectronicResources';

describe('getProcessingContextFromLocation', () => {
  it('returns the processing context from route state when present', () => {
    const context = {
      submissionId: 31,
      itemId: 88,
      folioCourseListingId: 'folio-course-123',
      offeringId: 44,
      canOpenProcessing: true,
    };

    expect(getProcessingContextFromLocation({ state: { processingContext: context } })).toBe(context);
  });

  it('returns null when no route state exists', () => {
    expect(getProcessingContextFromLocation(null)).toBeNull();
    expect(getProcessingContextFromLocation({ state: null })).toBeNull();
  });
});

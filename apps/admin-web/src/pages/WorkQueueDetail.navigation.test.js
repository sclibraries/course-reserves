import { describe, expect, it } from 'vitest';
import {
  buildWorkQueueProcessingAction,
  findSelectedWorkQueueItem,
  getCompletionReturnPath
} from './WorkQueueDetail';

describe('getCompletionReturnPath', () => {
  it('returns the valid my-work admin tab after checklist completion', () => {
    expect(getCompletionReturnPath()).toBe('/admin?tab=my-work');
  });
});

describe('findSelectedWorkQueueItem', () => {
  const items = [
    { id: 88, submission_id: 31, resource_id: 9001, title: 'Correct item' },
    { id: 99, submission_id: 88, resource_id: 31, title: 'Wrong fallback match' },
  ];

  it('selects claimed work queue items by item id only', () => {
    expect(findSelectedWorkQueueItem(items, '88')).toBe(items[0]);
  });

  it('does not select an item by submission id or resource id fallback', () => {
    expect(findSelectedWorkQueueItem(items, '31')).toBeUndefined();
  });
});

describe('buildWorkQueueProcessingAction', () => {
  it('returns navigation target and state when the item can open processing', () => {
    const action = buildWorkQueueProcessingAction({
      processingContext: {
        submissionId: 31,
        itemId: 88,
        folioCourseListingId: 'folio-course-123',
        offeringId: 44,
        canOpenProcessing: true,
      },
    });

    expect(action).toEqual({
      handoff: {
        pathname: '/admin/electronic/folio-course-123',
        state: {
          processingContext: expect.objectContaining({
            submissionId: 31,
            itemId: 88,
            folioCourseListingId: 'folio-course-123',
            offeringId: 44,
            canOpenProcessing: true,
          }),
        },
      },
      blockingReason: null,
    });
  });

  it('returns a blocking reason when processing cannot open', () => {
    const action = buildWorkQueueProcessingAction({
      processingContext: {
        folioCourseListingId: 'folio-course-123',
        canOpenProcessing: false,
        blockingReason: 'Submission is missing a local offering_id.',
      },
    });

    expect(action.handoff).toBeNull();
    expect(action.blockingReason).toBe('Submission is missing a local offering_id.');
  });
});

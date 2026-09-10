export const normalizeProcessingContext = (context) => {
  if (!context) return null;

  return {
    submissionId: context.submissionId ?? context.submission_id,
    submissionUuid: context.submissionUuid ?? context.submission_uuid,
    itemId: context.itemId ?? context.item_id,
    folioCourseListingId: context.folioCourseListingId ?? context.folio_course_listing_id,
    offeringId: context.offeringId ?? context.offering_id,
    itemStatus: context.itemStatus ?? context.item_status,
    claimedByStaffId: context.claimedByStaffId ?? context.claimed_by_staff_id,
    claimedAt: context.claimedAt ?? context.claimed_at,
    courseLinked: Boolean(context.courseLinked ?? context.course_linked),
    canOpenProcessing: Boolean(context.canOpenProcessing ?? context.can_open_processing),
    blockingReason: context.blockingReason ?? context.blocking_reason ?? null,
    returnTo: context.returnTo ?? context.return_to
  };
};

export const buildProcessingHandoff = (item) => {
  const processingContext = normalizeProcessingContext(
    item.processingContext ?? item.processing_context
  );

  const folioCourseListingId =
    processingContext?.folioCourseListingId ??
    item.folioCourseListingId ??
    item.folio_course_listing_id ??
    item.submission?.folioCourseListingId ??
    item.submission?.folio_course_listing_id;

  if (!processingContext || !processingContext.canOpenProcessing || !folioCourseListingId) {
    return null;
  }

  return {
    pathname: `/admin/electronic/${folioCourseListingId}`,
    state: {
      processingContext: {
        ...processingContext,
        folioCourseListingId
      }
    }
  };
};

export const getProcessingBlockReason = (item) => {
  const processingContext = normalizeProcessingContext(
    item.processingContext ?? item.processing_context
  );

  if (!processingContext) {
    return 'Processing context is missing.';
  }

  if (!processingContext.canOpenProcessing) {
    return processingContext.blockingReason || 'This item is not ready for processing yet.';
  }

  if (!processingContext.folioCourseListingId) {
    return 'Submission is not linked to a FOLIO course listing yet.';
  }

  return null;
};

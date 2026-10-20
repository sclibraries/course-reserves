/**
 * Format submission for display in queue
 * @param {Object} submission - Raw submission data from API
 * @returns {Object} Formatted submission object
 */
const submissionStatusLabels = {
  draft: 'Draft',
  pending: 'Pending',
  submitted: 'Submitted',
  in_progress: 'In Progress',
  complete: 'Complete',
  unavailable: 'Unavailable',
};

export function formatSubmissionStatusLabel(status) {
  return submissionStatusLabels[status] || status;
}

export function formatSubmissionForDisplay(submission) {
  // Handle case where newResources might not be present
  const newResources = submission.newResources || [];
  const reuseResources = submission.reuseResources || [];
  const allResources = [...newResources, ...reuseResources];

  // Parse resource_data JSON for each item
  const items = allResources.map(resource => {
    let data = {};
    try {
      data = resource.resource_data ? JSON.parse(resource.resource_data) : {};
    } catch (e) {
      console.warn('Failed to parse resource_data:', e);
      data = { title: 'Unknown', materialType: 'unknown' };
    }

    return {
      id: resource.id,
      title: data.title || 'Unknown',
      authors: data.authors || '',
      materialType: data.materialType || 'unknown',
      barcode: resource.source_barcode,
      callNumber: resource.source_call_number,
      status: resource.item_status || 'pending',
      isReuse: Boolean(resource.is_reuse),
      displayOrder: resource.display_order || 0,
      folderName: resource.folder_name
    };
  });

  // Count items by status
  const statusCounts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  // Count unread communications
  const communications = submission.communications || [];
  const unreadCount = communications.filter(c => !c.is_read).length;

  // Calculate days since submission
  const daysSince = Math.floor(
    (Date.now() - new Date(submission.submitted_at)) / (1000 * 60 * 60 * 24)
  );

  // Determine priority
  const priority = determinePriority(submission, daysSince);

  return {
    // Display fields
    submissionId: submission.submission_id,
    submissionUuid: submission.submission_uuid,
    courseCode: submission.course_code,
    courseTitle: submission.course_title,
    section: submission.section || '',
    term: submission.term_code,
    facultyName: submission.faculty_display_name,
    facultyId: submission.shibboleth_user_id,
    status: submission.status,
    submittedAt: submission.submitted_at,

    // Calculated fields
    totalItems: items.length,
    pendingItems: statusCounts.pending || 0,
    inProgressItems: statusCounts.in_progress || 0,
    completeItems: statusCounts.complete || 0,
    unavailableItems: statusCounts.unavailable || 0,
    daysSinceSubmission: daysSince,

    // Lock status
    isLocked: Boolean(submission.is_locked),
    lockedBy: submission.locked_by_staff_id,
    lockedAt: submission.locked_at,

    // Assignment
    assignedTo: submission.assignee_staff_user_id,

    // Communications
    communicationsCount: communications.length,
    unreadCommunications: unreadCount,

    // Computed
    completionPercentage: items.length > 0
      ? Math.round((statusCounts.complete || 0) / items.length * 100)
      : 0,
    priority
  };
}

export function formatProcessingContext(context) {
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
}

export function formatClaimedItem(item) {
  let resourceData = {};
  try {
    resourceData = item.resource_data ? JSON.parse(item.resource_data) : {};
  } catch (e) {
    console.warn('Failed to parse resource_data:', e);
  }

  return {
    ...item,
    title: resourceData.title || item.title || 'Untitled',
    authors: resourceData.authors || item.authors || '',
    materialTypeName: item.materialType?.name || resourceData.materialType || 'Unknown',
    barcode: item.source_barcode || resourceData.barcode,
    callNumber: item.source_call_number || resourceData.callNumber,
    url: resourceData.url,
    folioCourseListingId: item.folio_course_listing_id ?? item.submission?.folio_course_listing_id,
    offeringId: item.offering_id ?? item.submission?.offering_id,
    materializedResourceId: item.materialized_resource_id ?? null,
    materializedCourseResourceId: item.materialized_course_resource_id ?? null,
    materializedPhysicalReferenceId: item.materialized_physical_reference_id ?? null,
    materializedFolderId: item.materialized_folder_id ?? null,
    materializedAt: item.materialized_at ?? null,
    materializedByStaffId: item.materialized_by_staff_id ?? null,
    processingContext: formatProcessingContext(item.processing_context ?? item.processingContext)
  };
}

/**
 * Determine submission priority based on dates and status
 * @param {Object} submission - Submission data
 * @param {number} daysSince - Days since submission
 * @returns {string} Priority level (urgent, high, normal)
 */
export function determinePriority(submission, daysSince) {
  if (submission.needed_by_date) {
    const daysUntilNeeded = Math.floor(
      (new Date(submission.needed_by_date) - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilNeeded < 7) return 'urgent';
    if (daysUntilNeeded < 14) return 'high';
  }
  if (daysSince > 7) return 'high';
  return 'normal';
}

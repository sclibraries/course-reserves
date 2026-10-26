import { formatProcessingContext } from './submissionFormatters';

/**
 * Format detailed submission data
 * @param {Object} response - Raw submission detail from API
 * @returns {Object} Formatted submission detail
 */
export function formatSubmissionDetail(response) {
  const newResources = response.newResources || [];
  const reuseResources = response.reuseResources || [];
  const communications = response.communications || [];

  // Create a map of communications by resource_id for quick lookup
  const communicationsByResource = communications.reduce((acc, comm) => {
    if (comm.resource_id) {
      if (!acc[comm.resource_id]) {
        acc[comm.resource_id] = [];
      }
      acc[comm.resource_id].push(comm);
    }
    return acc;
  }, {});

  // Parse all items
  const allItems = [
    ...newResources.map(resource => ({ ...resource, is_reuse: false })),
    ...reuseResources.map(resource => ({ ...resource, is_reuse: true })),
  ].map((resource) => {
    let data = {};
    try {
      if (resource.resource_data) {
        data = typeof resource.resource_data === 'string'
          ? JSON.parse(resource.resource_data)
          : resource.resource_data;
      }
    } catch (e) {
      console.warn('Failed to parse resource_data:', e);
      data = { title: 'Unknown', materialType: 'unknown' };
    }

    // Get communications for this resource
    const itemCommunications = communicationsByResource[resource.id] || [];
    const unreadCount = itemCommunications.filter(c => !c.is_read).length;

    // Format claimed_by information if present
    // Note: Backend returns claimed_by_staff_id as string, convert to number
    const claimedByStaffId = resource.claimed_by_staff_id ? parseInt(resource.claimed_by_staff_id, 10) : null;

    // Try to extract display name from staff_notes if not provided
    // Pattern: "Claimed by [Name] at [timestamp]"
    let displayName = '';
    if (claimedByStaffId && resource.staff_notes) {
      const match = resource.staff_notes.match(/Claimed by (.+?) at \d{4}-\d{2}-\d{2}/);
      if (match) {
        displayName = match[1];
      }
    }

    const claimedBy = claimedByStaffId ? {
      id: claimedByStaffId,
      username: resource.claimed_by_username || '',
      display_name: displayName || `Staff Member #${claimedByStaffId}`
    } : null;

    return {
      id: resource.id,
      title: data.title || 'Unknown',
      authors: data.authors || '',
      materialType: data.materialType || 'unknown',
      url: data.url || null,
      isbn: data.isbn || null,
      doi: data.doi || null,
      issn: data.issn || null,
      journalTitle: data.journalTitle || null,
      volume: data.volume || null,
      issue: data.issue || null,
      eds: data.eds || null,
      publisher: data.publisher || null,
      publicationYear: data.publicationYear || null,
      barcode: resource.source_barcode,
      callNumber: resource.source_call_number,
      status: resource.item_status || 'pending',
      readiness: resource.readiness,
      readinessReason: resource.readiness_reason,
      flow: resource.flow,
      folderName: resource.folder_name,
      displayOrder: resource.display_order || 0,
      ...('position' in resource ? { claimPosition: resource.position } : {}),
      positionInFolder: resource.position_in_folder,
      facultyNotes: resource.faculty_notes,
      staffNotes: resource.staff_notes || '',
      isReuse: Boolean(resource.is_reuse),
      priority: resource.priority || 'medium',
      materialTypeId: resource.material_type_id,
      sourceResourceId: resource.source_resource_id,
      sourceFolioInstanceId: resource.source_folio_instance_id,
      folioCourseListingId: resource.folio_course_listing_id,
      offeringId: resource.offering_id,
      materializedResourceId: resource.materialized_resource_id ?? null,
      materializedCourseResourceId: resource.materialized_course_resource_id ?? null,
      materializedPhysicalReferenceId: resource.materialized_physical_reference_id ?? null,
      materializedFolderId: resource.materialized_folder_id ?? null,
      materializedAt: resource.materialized_at ?? null,
      materializedByStaffId: resource.materialized_by_staff_id ?? null,
      processingContext: formatProcessingContext(resource.processing_context),
      // Assignment information
      claimedBy: claimedBy,
      ...('claimed_by' in resource ? { claimedByUsername: resource.claimed_by } : {}),
      ...('claimed_by_display' in resource ? { claimedByDisplay: resource.claimed_by_display } : {}),
      claimedAt: resource.claimed_at || null,
      ...('last_activity_at' in resource ? { lastActivityAt: resource.last_activity_at } : {}),
      ...('expires_at' in resource ? { expiresAt: resource.expires_at } : {}),
      ...('assigned_group' in resource ? { assignedGroup: resource.assigned_group } : {}),
      // Communications associated with this item
      communications: itemCommunications,
      unreadCommunications: unreadCount,
      hasCommunications: itemCommunications.length > 0
    };
  });

  // Organize by folders
  const folders = {};
  const unfolderedItems = [];

  allItems.forEach(item => {
    if (item.folderName) {
      if (!folders[item.folderName]) {
        folders[item.folderName] = {
          name: item.folderName,
          items: []
        };
      }
      folders[item.folderName].items.push(item);
    } else {
      unfolderedItems.push(item);
    }
  });

  // Sort items within folders by position_in_folder (nulls last)
  Object.values(folders).forEach(folder => {
    folder.items.sort((a, b) => {
      const posA = a.positionInFolder ?? 9999;
      const posB = b.positionInFolder ?? 9999;
      return posA - posB;
    });
  });

  // Sort unfoldered items by display_order
  unfolderedItems.sort((a, b) => a.displayOrder - b.displayOrder);

  // Calculate statistics
  const statusCounts = allItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  // Get general communications (not associated with specific resources)
  const generalCommunications = communications.filter(c => !c.resource_id);

  return {
    submission: {
      id: response.submission_id,
      uuid: response.submission_uuid,
      courseCode: response.course_code,
      courseTitle: response.course_title,
      section: response.section || '',
      term: response.term_code,
      facultyName: response.faculty_display_name,
      facultyId: response.shibboleth_user_id,
      proxyName: response.proxy_display_name,
      proxyId: response.proxy_shibboleth_user_id,
      status: response.status,
      submittedAt: response.submitted_at,
      neededByDate: response.needed_by_date,
      submissionNotes: response.submission_notes,
      isLocked: Boolean(response.is_locked),
      lockedBy: response.locked_by_staff_id,
      lockedAt: response.locked_at,
      lockReason: response.lock_reason,
      assignedTo: response.assignee_staff_user_id,
      isDuplicatePrevious: Boolean(response.is_duplicate_previous),
      duplicateNote: response.duplicate_note,
      emailConfirmationSent: Boolean(response.email_confirmation_sent),
      folioCourseListingId: response.folio_course_listing_id,
      offeringId: response.offering_id,
      ...('link_state' in response ? { linkState: response.link_state } : {}),
      ...('link_flag' in response ? { linkFlag: response.link_flag } : {}),
      ...('linked_at' in response ? { linkedAt: response.linked_at } : {}),
      ...('linked_by' in response ? { linkedBy: response.linked_by } : {}),
      ...('its_course_id' in response ? { itsCourseId: response.its_course_id } : {}),
      ...('academic_period' in response ? { academicPeriod: response.academic_period } : {}),
      ...('roster_term_id' in response ? { rosterTermId: response.roster_term_id } : {}),
    },

    folders: Object.values(folders).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),

    unfolderedItems,

    statistics: {
      totalItems: allItems.length,
      totalFolders: Object.keys(folders).length,
      byStatus: {
        pending: statusCounts.pending || 0,
        inProgress: statusCounts.in_progress || 0,
        complete: statusCounts.complete || 0,
        unavailable: statusCounts.unavailable || 0
      },
      completionPercentage: allItems.length > 0
        ? Math.round((statusCounts.complete || 0) / allItems.length * 100)
        : 0
    },

    communications: {
      all: communications,
      general: generalCommunications,
      total: communications.length,
      unread: communications.filter(c => !c.is_read).length,
      byResource: communicationsByResource
    },

    workflowAssignment: response.workflowAssignment
  };
}

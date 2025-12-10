/**
 * @file submissionWorkflowService.js
 * @description Service for handling faculty submission workflow operations
 */

const API_BASE = 'https://libtools2.smith.edu/course-reserves/backend/web';

export const submissionWorkflowService = {
  getAuthToken: () => `Bearer ${localStorage.getItem('authToken')}`,

  /**
   * Fetch pending submissions with pagination
   * @param {number} page - Page number (default: 1)
   * @param {number} perPage - Items per page (default: 20)
   * @returns {Promise<Object>} Submissions list with pagination metadata
   */
  async getPendingSubmissions(page = 1, perPage = 20) {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString()
      });

      const response = await fetch(
        `${API_BASE}/submission-workflow/pending-submissions?${queryParams}`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch pending submissions: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle both response formats:
      // 1. New format: { items: [], _meta: {}, _links: {} }
      // 2. Current format: [] (plain array)
      if (Array.isArray(data)) {
        // Plain array response - create the expected structure
        return {
          items: data,
          _meta: {
            totalCount: data.length,
            pageCount: 1,
            currentPage: page,
            perPage: perPage
          },
          _links: {
            self: { href: `${API_BASE}/submission-workflow/pending-submissions?page=${page}&per_page=${perPage}` }
          }
        };
      }
      
      // Return the response as-is if it's already in the expected format
      return data;
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
      throw error;
    }
  },

  /**
   * Fetch detailed information for a specific submission
   * @param {string|number} submissionId - Submission ID (numeric)
   * @returns {Promise<Object>} Detailed submission information
   */
  async getSubmissionDetail(submissionId) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/submission/${submissionId}`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch submission detail: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching submission detail:', error);
      throw error;
    }
  },

  /**
   * Lock a submission for processing
   * @param {string} submissionUuid - Submission UUID
   * @param {string} lockReason - Reason for locking (optional)
   * @returns {Promise<Object>} Lock confirmation
   */
  async lockSubmission(submissionUuid, lockReason = 'Processing items') {
    try {
      const response = await fetch(
        `${API_BASE}/faculty-submission/${submissionUuid}/lock`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ lock_reason: lockReason })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to lock submission: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error locking submission:', error);
      throw error;
    }
  },

  /**
   * Unlock a submission
   * @param {string} submissionUuid - Submission UUID
   * @returns {Promise<Object>} Unlock confirmation
   */
  async unlockSubmission(submissionUuid) {
    try {
      const response = await fetch(
        `${API_BASE}/faculty-submission/${submissionUuid}/unlock`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to unlock submission: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unlocking submission:', error);
      throw error;
    }
  },

  /**
   * Update an individual item's status and notes
   * @param {number} itemId - Item ID from submission_new_resources
   * @param {Object} updates - Fields to update
   * @param {string} [updates.item_status] - One of: pending, in_progress, complete, unavailable
   * @param {string} [updates.staff_notes] - Internal staff notes
   * @param {string} [updates.priority] - One of: high, medium, low
   * @param {string} [updates.faculty_notes] - Notes visible to faculty
   * @returns {Promise<Object>} Updated item data
   */
  async updateItem(itemId, updates) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update item: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },

  /**
   * Claim an item for processing (assign to self)
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Updated item with claim info
   */
  async claimItem(itemId) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}/claim`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to claim item: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error claiming item:', error);
      throw error;
    }
  },

  /**
   * Unclaim an item (remove assignment)
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Updated item
   */
  async unclaimItem(itemId) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}/unclaim`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to unclaim item: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unclaiming item:', error);
      throw error;
    }
  },

  /**
   * Assign item to another staff member
   * @param {number} itemId - Item ID
   * @param {number} userId - User ID to assign to
   * @param {string} reason - Optional reason for assignment
   * @returns {Promise<Object>} Updated item
   */
  async assignItem(itemId, userId, reason = '') {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}/assign`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId, reason })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to assign item: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error assigning item:', error);
      throw error;
    }
  },

  /**
   * Quick status update (without opening full modal)
   * @param {number} itemId - Item ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated item
   */
  async updateItemStatus(itemId, status) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}/status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ item_status: status })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating item status:', error);
      throw error;
    }
  },

  /**
   * Add staff communication message
   * @param {number} itemId - Item ID (0 for general submission message)
   * @param {string} message - Message content
   * @param {Array<number>} mentionedUserIds - Array of user IDs mentioned
   * @returns {Promise<Object>} Created communication
   */
  async addStaffCommunication(itemId, message, mentionedUserIds = []) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}/staff-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            message, 
            mentioned_user_ids: mentionedUserIds 
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to add message: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding staff communication:', error);
      throw error;
    }
  },

  /**
   * Get staff communications for an item
   * @param {number} itemId - Item ID
   * @returns {Promise<Array>} Staff messages
   */
  async getStaffCommunications(itemId) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/item/${itemId}/staff-messages`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get staff messages: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting staff communications:', error);
      throw error;
    }
  },

  /**
   * Get list of staff users for assignment
   * @returns {Promise<Array>} Staff users
   */
  async getStaffUsers() {
    try {
      const response = await fetch(
        `${API_BASE}/user/staff`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get staff users: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting staff users:', error);
      throw error;
    }
  },

  /**
   * Get items claimed by the current user (determined by auth token)
   * @returns {Promise<Array>} Claimed items with submission context
   */
  async getMyClaimedItems() {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/my-claimed-items`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get claimed items: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting claimed items:', error);
      throw error;
    }
  },

  /**
   * Get current user info from auth token
   * @returns {Promise<Object>} Current user object with id
   */
  async getCurrentUser() {
    try {
      const response = await fetch(
        `${API_BASE}/user/current`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get current user: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  /**
   * Format submission for display in queue
   * @param {Object} submission - Raw submission data from API
   * @returns {Object} Formatted submission object
   */
  formatSubmissionForDisplay(submission) {
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
    const priority = this.determinePriority(submission, daysSince);

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
  },

  /**
   * Format detailed submission data
   * @param {Object} response - Raw submission detail from API
   * @returns {Object} Formatted submission detail
   */
  formatSubmissionDetail(response) {
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
    const allItems = [...newResources, ...reuseResources].map(resource => {
      let data = {};
      try {
        data = resource.resource_data ? JSON.parse(resource.resource_data) : {};
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
        publisher: data.publisher || null,
        publicationYear: data.publicationYear || null,
        barcode: resource.source_barcode,
        callNumber: resource.source_call_number,
        status: resource.item_status || 'pending',
        folderName: resource.folder_name,
        displayOrder: resource.display_order || 0,
        positionInFolder: resource.position_in_folder,
        facultyNotes: resource.faculty_notes,
        staffNotes: resource.staff_notes || '',
        isReuse: Boolean(resource.is_reuse),
        priority: resource.priority || 'medium',
        materialTypeId: resource.material_type_id,
        sourceResourceId: resource.source_resource_id,
        sourceFolioInstanceId: resource.source_folio_instance_id,
        // Assignment information
        claimedBy: claimedBy,
        claimedAt: resource.claimed_at || null,
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
        folioCourseListingId: response.folio_course_listing_id
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
  },

  /**
   * Determine submission priority based on dates and status
   * @param {Object} submission - Submission data
   * @param {number} daysSince - Days since submission
   * @returns {string} Priority level (urgent, high, normal)
   */
  determinePriority(submission, daysSince) {
    if (submission.needed_by_date) {
      const daysUntilNeeded = Math.floor(
        (new Date(submission.needed_by_date) - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilNeeded < 7) return 'urgent';
      if (daysUntilNeeded < 14) return 'high';
    }
    if (daysSince > 7) return 'high';
    return 'normal';
  },

  /**
   * Get all communications for a submission
   * @param {string} submissionId - Numeric submission ID
   * @returns {Promise<Array>} Array of communications
   */
  async getSubmissionCommunications(submissionId) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/submission/${submissionId}/communications`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch communications: ${response.status}`);
      }

      const data = await response.json();
      // API returns { messages: [...], submission: {...} }
      return data.messages || [];
    } catch (error) {
      console.error('Error fetching communications:', error);
      throw error;
    }
  },

  /**
   * Create a new communication (message, note, or task)
   * @param {string} submissionId - Submission ID
   * @param {Object} data - Communication data
   * @returns {Promise<Object>} Created communication
   */
  async createCommunication(submissionId, data) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/submission/${submissionId}/communications`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to create communication: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating communication:', error);
      throw error;
    }
  },

  /**
   * Update an existing communication
   * @param {number} messageId - Message ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated communication
   */
  async updateCommunication(messageId, data) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/communications/${messageId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update communication: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating communication:', error);
      throw error;
    }
  },

  /**
   * Mark a communication as read
   * @param {number} messageId - Message ID
   * @returns {Promise<Object>} Response
   */
  async markAsRead(messageId) {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/communications/${messageId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to mark as read: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  },

  /**
   * Search for staff users (for @mention autocomplete)
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of staff users
   */
  async searchStaff(query) {
    try {
      if (query.length < 2) {
        return [];
      }

      const response = await fetch(
        `${API_BASE}/submission-workflow/search-staff?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to search staff: ${response.status}`);
      }

      const data = await response.json();
      return data.users || [];
    } catch (error) {
      console.error('Error searching staff:', error);
      throw error;
    }
  },

  /**
   * Get unread message count for current user
   * @returns {Promise<Object>} { unread_count, user_id, username }
   */
  async getUnreadCount() {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/my-unread-count`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get unread count: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  },

  /**
   * Get all mentions for current user
   * @returns {Promise<Object>} { mentions: [...], total }
   */
  async getMyMentions() {
    try {
      const response = await fetch(
        `${API_BASE}/submission-workflow/my-mentions`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get mentions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting mentions:', error);
      throw error;
    }
  },

  /**
   * Link a FOLIO course to a workflow instance step (check_course_exists automation)
   * @param {number} instanceId - Workflow instance ID
   * @param {number} stepId - Step ID (instance_step_id)
   * @param {Object} data - FOLIO identifier { course_id }
   * @returns {Promise<Object>} Updated workflow instance
   */
  async linkFolioCourse(instanceId, stepId, data) {
    try {
      const response = await fetch(
        `${API_BASE}/workflow-admin/instance/${instanceId}/steps/${stepId}/folio/link`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to link FOLIO course: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error linking FOLIO course:', error);
      throw error;
    }
  }
};

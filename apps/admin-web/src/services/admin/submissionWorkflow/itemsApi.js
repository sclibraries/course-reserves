import { apiConfig } from '../../../config/api.config';
import { authFetch } from '../../http/authFetch';
import { formatClaimedItem } from './submissionFormatters';

export const itemsApi = {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}`,
        {
          method: 'PUT',
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/claim`,
        {
          method: 'POST',
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/unclaim`,
        {
          method: 'POST',
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/assign`,
        {
          method: 'POST',
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}`,
        {
          method: 'PUT',
          headers: {
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
   * Publish a processed faculty workflow item into the course reserves course.
   * @param {number} itemId - Item ID from submission_new_resources
   * @param {Object} payload - Optional completion details
   * @returns {Promise<Object>} Completion response with materialization ids
   */
  async completeProcessing(itemId, payload = {}) {
    try {
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/complete-processing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to complete processing: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error completing item processing:', error);
      throw error;
    }
  },

  /**
   * Switch the workflow for an item to a new template
   * @param {number} itemId - Item ID
   * @param {number} newTemplateId - ID of the new workflow template
   * @returns {Promise<Object>} New workflow instance
   */
  async switchItemWorkflow(itemId, newTemplateId) {
    try {
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/switch-workflow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ template_id: newTemplateId })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to switch workflow: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error switching workflow:', error);
      throw error;
    }
  },

  /**
   * Get items claimed by the current user (determined by auth token)
   * @returns {Promise<Array>} Claimed items with submission context
   */
  async getMyClaimedItems() {
    try {
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/my-claimed-items`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get claimed items: ${response.status}`);
      }

      const items = await response.json();
      return items.map(item => formatClaimedItem(item));
    } catch (error) {
      console.error('Error getting claimed items:', error);
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/workflow-admin/instance/${instanceId}/steps/${stepId}/folio/link`,
        {
          method: 'POST',
          headers: {
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

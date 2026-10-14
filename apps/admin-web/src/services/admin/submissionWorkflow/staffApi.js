import { apiConfig } from '../../../config/api.config';
import { authFetch } from '../../http/authFetch';

export const staffApi = {
  /**
   * Add staff communication message
   * @param {number} itemId - Item ID (0 for general submission message)
   * @param {string} message - Message content
   * @param {Array<number>} mentionedUserIds - Array of user IDs mentioned
   * @returns {Promise<Object>} Created communication
   */
  async addStaffCommunication(itemId, message, mentionedUserIds = []) {
    try {
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/staff-message`,
        {
          method: 'POST',
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/item/${itemId}/staff-messages`,
        {
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/user/staff`,
        {
          headers: {
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
   * Get current user info from auth token
   * @returns {Promise<Object>} Current user object with id
   */
  async getCurrentUser() {
    try {
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/user/current`,
        {
          headers: {
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
   * Search for staff users (for @mention autocomplete)
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of staff users
   */
  async searchStaff(query) {
    try {
      if (query.length < 2) {
        return [];
      }

      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/search-staff?q=${encodeURIComponent(query)}`,
        {
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/my-unread-count`,
        {
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/my-mentions`,
        {
          headers: {
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
};

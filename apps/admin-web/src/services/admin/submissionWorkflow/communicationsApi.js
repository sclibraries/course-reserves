import { apiConfig } from '../../../config/api.config';
import { authFetch } from '../../http/authFetch';

async function createRequestError(response, message) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // Some failed responses have no JSON body.
  }
  return Object.assign(new Error(message), {
    reference: payload.reference || payload.reference_id,
  });
}

export const communicationsApi = {
  /**
   * Get all communications for a submission
   * @param {string} submissionId - Numeric submission ID
   * @returns {Promise<Array>} Array of communications
   */
  async getSubmissionCommunications(submissionId) {
    try {
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/submission/${submissionId}/communications`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw await createRequestError(response, 'Communications request failed');
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/submission/${submissionId}/communications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        throw await createRequestError(response, 'Communication request failed');
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/communications/${messageId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );

      if (!response.ok) {
        throw await createRequestError(response, 'Communication request failed');
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/communications/${messageId}/read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw await createRequestError(response, 'Communication request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  },
};

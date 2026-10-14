import { apiConfig } from '../../../config/api.config';
import { authFetch } from '../../http/authFetch';

export const submissionsApi = {
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

      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/pending-submissions?${queryParams}`,
        {
          headers: {
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
            self: { href: `${apiConfig.urls.courseReserves}/submission-workflow/pending-submissions?page=${page}&per_page=${perPage}` }
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/submission-workflow/submission/${submissionId}`,
        {
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/faculty-submission/${submissionUuid}/lock`,
        {
          method: 'POST',
          headers: {
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
      const response = await authFetch(
        `${apiConfig.urls.courseReserves}/faculty-submission/${submissionUuid}/unlock`,
        {
          method: 'POST',
          headers: {
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
};

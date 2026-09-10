/**
 * @file checklistService.js
 * Simple service for managing checklist templates and item checklists
 */

import { apiConfig } from '../../config/api.config';

class ChecklistService {
  getAuthToken() {
    const match = document.cookie.match(/(^| )accessToken=([^;]+)/);
    const token = match ? decodeURIComponent(match[2]) : null;
    return token ? `Bearer ${token}` : '';
  }

  /**
   * Get all checklist templates
   */
  async listTemplates() {
    try {
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${apiConfig.endpoints.checklist.listTemplates}`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Checklist API not yet implemented - returning empty array');
        return [];
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch checklist templates');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      // Return empty array instead of throwing - backend not yet implemented
      return [];
    }
  }

  /**
   * Get a specific checklist template
   */
  async getTemplate(templateId) {
    try {
      const url = apiConfig.endpoints.checklist.getTemplate.replace(':id', templateId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch checklist template');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Create a new checklist template
   * @param {Object} templateData - Template data
   * @param {string} username - Current user's username
   */
  async createTemplate(templateData, username) {
    try {
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${apiConfig.endpoints.checklist.createTemplate}`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...templateData,
            created_by: username
          }),
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to create checklist template');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Update an existing checklist template
   * @param {number} templateId - Template ID
   * @param {Object} templateData - Template data
   * @param {string} username - Current user's username
   */
  async updateTemplate(templateId, templateData, username) {
    try {
      const url = apiConfig.endpoints.checklist.updateTemplate.replace(':id', templateId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...templateData,
            updated_by: username
          }),
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to update checklist template');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Delete a checklist template
   */
  async deleteTemplate(templateId) {
    try {
      const url = apiConfig.endpoints.checklist.deleteTemplate.replace(':id', templateId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to delete checklist template');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Duplicate a checklist template
   */
  async duplicateTemplate(templateId) {
    try {
      const url = apiConfig.endpoints.checklist.duplicateTemplate.replace(':id', templateId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to duplicate checklist template');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Get checklist for a specific submission item
   */
  async getItemChecklist(itemId) {
    try {
      const url = apiConfig.endpoints.checklist.getItemChecklist.replace(':itemId', itemId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Checklist API not yet implemented');
        return null;
      }
      if (!response.ok) {
        // Parse error response to get the message
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || 'Failed to fetch item checklist');
        error.status = response.status;
        error.response = errorData;
        throw error;
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Assign a checklist template to an item
   * @param {number} itemId - Item ID
   * @param {number} templateId - Template ID
   * @param {string} username - Current user's username
   */
  async assignChecklistToItem(itemId, templateId, username) {
    try {
      const url = apiConfig.endpoints.checklist.assignChecklist.replace(':itemId', itemId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            template_id: templateId,
            assigned_by: username
          }),
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to assign checklist to item');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Update task completion status
   * @param {number} itemId - Item ID
   * @param {number} taskId - Task ID
   * @param {boolean} completed - Completion status
   * @param {string} notes - Optional notes
   * @param {string} username - Current user's username
   */
  async updateTaskStatus(itemId, taskId, completed, notes = null, username = null) {
    try {
      const url = apiConfig.endpoints.checklist.updateTask
        .replace(':itemId', itemId)
        .replace(':taskId', taskId);
      
      const body = { completed, notes };
      if (completed && username) {
        body.completed_by = username;
      }
      
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to update task status');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }

  /**
   * Complete all remaining tasks and mark item as done
   * @param {number} itemId - Item ID
   * @param {string} username - Current user's username
   */
  async completeItemChecklist(itemId, username) {
    try {
      const url = apiConfig.endpoints.checklist.completeChecklist.replace(':itemId', itemId);
      const response = await fetch(
        `${apiConfig.urls.courseReserves}${url}`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthToken(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ completed_by: username })
        }
      );
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Checklist API not yet implemented');
      }
      if (!response.ok) {
        throw new Error('Failed to complete item checklist');
      }
      return response.json();
    } catch (error) {
      console.error('Checklist API error:', error);
      throw error;
    }
  }
}

export const checklistService = new ChecklistService();

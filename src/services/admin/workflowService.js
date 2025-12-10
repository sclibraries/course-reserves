/**
 * @file workflowService.js
 * @description Service for interacting with workflow management APIs
 */

import { apiConfig } from '../../config/api.config';

/**
 * Workflow Service
 * Handles all workflow-related API calls including templates, steps, conditions, transitions, and instances
 */
class WorkflowService {
  getAuthToken() {
    return `Bearer ${localStorage.getItem('authToken')}`;
  }

  async apiCall(url, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Authorization': this.getAuthToken(),
        'Content-Type': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorPayload;
      try {
        errorPayload = await response.json();
      } catch {
        const rawText = await response.text();
        const fallbackError = new Error(rawText || `Request failed with status ${response.status}`);
        fallbackError.status = response.status;
        throw fallbackError;
      }

      const apiError = new Error(errorPayload.message || `Request failed with status ${response.status}`);
      apiError.status = response.status;
      apiError.code = errorPayload.code;
      apiError.details = errorPayload;
      throw apiError;
    }

    // Handle empty responses (DELETE operations)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: true };
    }

    return await response.json();
  }

  // ==========================================
  // TEMPLATE MANAGEMENT
  // ==========================================

  /**
   * List all workflow templates with optional filters
   * @param {Object} filters - Optional filters
   * @param {string} filters.type - Filter by 'course' or 'item'
   * @param {boolean} filters.active - Filter by active status
   * @returns {Promise<Array>} List of workflow templates
   */
  async listTemplates(filters = {}) {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.active !== undefined) params.append('active', filters.active ? '1' : '0');
    
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.listTemplates}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.apiCall(url, 'GET');
    return response.templates || [];
  }

  /**
   * Get full template details including steps, conditions, and transitions
   * @param {number} id - Template ID
   * @returns {Promise<Object>} Template details
   */
  async getTemplate(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.getTemplate.replace(':id', id)}`;
    return await this.apiCall(url, 'GET');
  }

  /**
   * Create a new workflow template
   * @param {Object} data - Template data
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.createTemplate}`;
    return await this.apiCall(url, 'POST', data);
  }

  /**
   * Update existing template
   * @param {number} id - Template ID
   * @param {Object} data - Updated template data
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(id, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.updateTemplate.replace(':id', id)}`;
    return await this.apiCall(url, 'PUT', data);
  }

  /**
   * Delete/Archive a template (sets is_active to 0)
   * @param {number} id - Template ID
   * @returns {Promise<Object>} Archived template
   */
  async deleteTemplate(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.archiveTemplate.replace(':id', id)}`;
    return await this.apiCall(url, 'POST');
  }

  /**
   * Archive a template (alias for deleteTemplate for clarity)
   * @param {number} id - Template ID
   * @returns {Promise<Object>} Archived template
   */
  async archiveTemplate(id) {
    return await this.deleteTemplate(id);
  }

  /**
   * Duplicate an existing template
   * @param {number} id - Template ID to duplicate
   * @param {string} newName - Name for the duplicated template
   * @returns {Promise<Object>} New template
   */
  async duplicateTemplate(id, newName) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.duplicateTemplate.replace(':id', id)}`;
    return await this.apiCall(url, 'POST', { new_name: newName });
  }

  // ==========================================
  // STEP MANAGEMENT
  // ==========================================

  /**
   * Create a new step in a template
   * @param {number} templateId - Template ID
   * @param {Object} data - Step data
   * @returns {Promise<Object>} Created step
   */
  async createStep(templateId, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.createStep.replace(':templateId', templateId)}`;
    return await this.apiCall(url, 'POST', data);
  }

  /**
   * Update a step
   * @param {number} id - Step ID
   * @param {Object} data - Updated step data
   * @returns {Promise<Object>} Updated step
   */
  async updateStep(id, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.updateStep.replace(':id', id)}`;
    return await this.apiCall(url, 'PUT', data);
  }

  /**
   * Delete a step
   * @param {number} id - Step ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteStep(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.deleteStep.replace(':id', id)}`;
    return await this.apiCall(url, 'DELETE');
  }

  /**
   * Reorder steps in a template
   * @param {number} templateId - Template ID
   * @param {Array} steps - Array of {id, sequence_order} objects
   * @returns {Promise<Object>} Update confirmation
   */
  async reorderSteps(templateId, steps) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.reorderSteps.replace(':templateId', templateId)}`;
    return await this.apiCall(url, 'PUT', { steps });
  }

  // ==========================================
  // CONDITION MANAGEMENT
  // ==========================================

  /**
   * Create a condition for a step
   * @param {number} stepId - Step ID
   * @param {Object} data - Condition data
   * @returns {Promise<Object>} Created condition
   */
  async createCondition(stepId, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.createCondition.replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'POST', data);
  }

  /**
   * Update a condition
   * @param {number} id - Condition ID
   * @param {Object} data - Updated condition data
   * @returns {Promise<Object>} Updated condition
   */
  async updateCondition(id, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.updateCondition.replace(':id', id)}`;
    return await this.apiCall(url, 'PUT', data);
  }

  /**
   * Delete a condition
   * @param {number} id - Condition ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteCondition(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.deleteCondition.replace(':id', id)}`;
    return await this.apiCall(url, 'DELETE');
  }

  // ==========================================
  // TRANSITION MANAGEMENT
  // ==========================================

  /**
   * Create a transition between steps
   * @param {number} stepId - From step ID
   * @param {Object} data - Transition data
   * @returns {Promise<Object>} Created transition
   */
  async createTransition(stepId, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.createTransition.replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'POST', data);
  }

  /**
   * Update a transition
   * @param {number} id - Transition ID
   * @param {Object} data - Updated transition data
   * @returns {Promise<Object>} Updated transition
   */
  async updateTransition(id, data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.updateTransition.replace(':id', id)}`;
    return await this.apiCall(url, 'PUT', data);
  }

  /**
   * Delete a transition
   * @param {number} id - Transition ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteTransition(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.deleteTransition.replace(':id', id)}`;
    return await this.apiCall(url, 'DELETE');
  }

  // ==========================================
  // INSTANCE MANAGEMENT (EXECUTION)
  // ==========================================

  /**
   * List workflow instances with filters
   * @param {Object} filters - Optional filters
   * @param {number} filters.template_id - Filter by template
   * @param {string} filters.entity_type - Filter by 'course' or 'item'
   * @param {number} filters.entity_id - Filter by entity ID
   * @param {number} filters.submission_id - Filter by submission
   * @param {string} filters.status - Filter by status
   * @param {string} filters.assigned_to - Filter by assigned user
   * @returns {Promise<Array>} List of workflow instances
   */
  async listInstances(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.listInstances}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.apiCall(url, 'GET');
    return response.instances || [];
  }

  /**
   * Get single workflow instance with full history
   * @param {number} id - Instance ID
   * @returns {Promise<Object>} Instance details with history
   */
  async getInstance(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.getInstance.replace(':id', id)}`;
    const response = await this.apiCall(url, 'GET');
    // Handle nested response structure
    return response.instance || response;
  }

  /**
   * Create a new workflow instance
   * @param {Object} data - Instance data
   * @param {number} data.template_id - Template ID
   * @param {string} data.entity_type - 'course' or 'item'
   * @param {number} data.entity_id - Entity ID
   * @param {number} [data.submission_id] - Optional submission ID
   * @param {string} [data.priority] - Optional priority
   * @param {string} [data.due_date] - Optional due date (YYYY-MM-DD)
   * @returns {Promise<Object>} Created instance
   */
  async createInstance(data) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.createInstance}`;
    return await this.apiCall(url, 'POST', data);
  }

  /**
   * Start a workflow (moves to first step)
   * @param {number} id - Instance ID
   * @returns {Promise<Object>} Updated instance
   */
  async startWorkflow(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.startWorkflow.replace(':id', id)}`;
    return await this.apiCall(url, 'POST');
  }

  /**
   * Complete current step and advance to next
   * @param {number} id - Instance ID
   * @param {Object} stepData - Data collected in this step
   * @param {Object} conditionResults - Condition values that determine next step
   * @param {string} [notes] - Optional notes
   * @returns {Promise<Object>} Result with next step info
   */
  async completeStep(id, stepData, conditionResults, notes = null) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.completeStep.replace(':id', id)}`;
    return await this.apiCall(url, 'POST', {
      step_data: stepData,
      condition_results: conditionResults,
      notes
    });
  }

  /**
   * Skip the current step (for optional steps)
   * @param {number} id - Instance ID
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>} Result with next step info
   */
  async skipStep(id, reason) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.skipStep.replace(':id', id)}`;
    return await this.apiCall(url, 'POST', { reason });
  }

  /**
   * Go back to the previous step
   * @param {number} id - Instance ID
   * @param {string} [reason] - Optional reason for going back
   * @returns {Promise<Object>} Result with previous step info
   */
  async goBack(id, reason = '') {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.goBack.replace(':id', id)}`;
    const payload = { reason };
    console.log('goBack API call:', { url, payload });
    return await this.apiCall(url, 'POST', payload);
  }

  /**
   * Cancel a workflow
   * @param {number} id - Instance ID
   * @param {string} reason - Reason for cancellation
   * @returns {Promise<Object>} Cancellation confirmation
   */
  async cancelWorkflow(id, reason) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.cancelWorkflow.replace(':id', id)}`;
    return await this.apiCall(url, 'POST', { reason });
  }

  /**
   * Put workflow on hold
   * @param {number} id - Instance ID
   * @param {string} reason - Reason for hold
   * @returns {Promise<Object>} Hold confirmation
   */
  async holdWorkflow(id, reason) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.holdWorkflow.replace(':id', id)}`;
    return await this.apiCall(url, 'POST', { reason });
  }

  /**
   * Resume a workflow from hold
   * @param {number} id - Instance ID
   * @returns {Promise<Object>} Resume confirmation
   */
  async resumeWorkflow(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.resumeWorkflow.replace(':id', id)}`;
    return await this.apiCall(url, 'POST');
  }

  /**
   * Retrieve the checklist of steps for a workflow instance
   * @param {number} id - Instance ID
   * @returns {Promise<Object>} Checklist data including steps, counts, and progress mode
   */
  async getInstanceSteps(id) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.getInstanceSteps.replace(':id', id)}`;
    return await this.apiCall(url, 'GET');
  }

  /**
   * Mark a step as complete or transition it in the checklist
   * @param {number} instanceId - Workflow instance ID
   * @param {number} stepId - Step ID to transition
   * @param {Object} payload - Optional payload including notes or metadata
   * @returns {Promise<Object>} Updated instance state
   */
  async transitionStep(instanceId, stepId, payload = {}) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.transitionStep
      .replace(':id', instanceId)
      .replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'PATCH', payload);
  }

  /**
   * Trigger an automation handler for a specific step
   * @param {number} instanceId - Workflow instance ID
   * @param {number} stepId - Step ID with automation handler
   * @returns {Promise<Object>} Automation execution response
   */
  async runAutomation(instanceId, stepId, payload = {}) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.runAutomation
      .replace(':id', instanceId)
      .replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'POST', payload);
  }

  /**
   * Trigger automation for a specific step using the dedicated step endpoint
   * @param {number} instanceId - Workflow instance ID
   * @param {number} stepId - Step ID with automation handler
   * @param {Object} payload - Optional payload such as notes or metadata
   * @returns {Promise<Object>} Automation execution response
   */
  async runStepAutomation(instanceId, stepId, payload = {}) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.runStepAutomation
      .replace(':id', instanceId)
      .replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'POST', payload);
  }

  /**
   * Run the FOLIO course/link automation for a specific gate step
   * @param {number} instanceId - Workflow instance ID
   * @param {number} stepId - FOLIO gate step ID
   * @param {Object} payload - { course_id, term_id }
   * @returns {Promise<Object>} Updated instance state
   */
  async runFolioLink(instanceId, stepId, payload) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.runFolioLink
      .replace(':id', instanceId)
      .replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'POST', payload);
  }

  /**
   * Mark a specific step as complete using the checklist endpoint
   * @param {number} instanceId - Workflow instance ID
   * @param {number} stepId - Step ID to mark complete
   * @param {Object} payload - Optional payload such as notes
   * @returns {Promise<Object>} Updated instance state
   */
  async completeStepById(instanceId, stepId, payload = {}) {
    const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.completeStepById
      .replace(':id', instanceId)
      .replace(':stepId', stepId)}`;
    return await this.apiCall(url, 'POST', payload);
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Calculate due date X days from now
   * @param {number} days - Number of days from now
   * @returns {string} Date in YYYY-MM-DD format
   */
  calculateDueDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Auto-create workflow instance for a submission item
   * @param {number} submissionId - Submission ID
   * @param {number} resourceId - Resource/Item ID
   * @param {string} category - Material category (book, article, video, etc.)
   * @param {string} entityType - 'course' or 'item'
   * @returns {Promise<Object>} Created and started instance
   */
  async autoCreateWorkflow(submissionId, resourceId, category, entityType = 'item') {
    try {
      // Find appropriate template
      const templates = await this.listTemplates({
        type: entityType,
        active: true
      });

      // Match by category or use default
      let template = templates.find(t => t.category === category);
      if (!template && entityType === 'item') {
        // Fall back to default item workflow if no category match
        template = templates.find(t => t.category === 'default' || !t.category);
      }

      if (!template) {
        throw new Error(`No workflow template found for ${entityType} with category ${category}`);
      }

      // Create instance
      const response = await this.createInstance({
        template_id: template.id,
        entity_type: entityType,
        entity_id: resourceId,
        submission_id: submissionId,
        priority: 'normal',
        due_date: this.calculateDueDate(7) // 7 days default
      });

      // Extract instance from response - handle both direct and nested structures
      const instance = response.instance || response;
      
      if (!instance || !instance.id) {
        throw new Error('Invalid response from server - missing instance ID');
      }

      // Start workflow
      await this.startWorkflow(instance.id);

      return instance;
    } catch (error) {
      console.error('Failed to auto-create workflow:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const workflowService = new WorkflowService();

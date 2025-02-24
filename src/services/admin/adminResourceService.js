const API_BASE = 'https://libtools2.smith.edu/course-reserves/backend/web';
import { ADMIN_ERROR_MESSAGES } from '../../constants/admin';

export const adminResourceService = {
  getAuthToken: () => `Bearer ${localStorage.getItem('authToken')}`,

  async getAllResources() {
    try {
        const response = await fetch(`${API_BASE}/resource?expand=material_type_name,course_count, metadata`);
        if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
        return response.json();
    } catch (error) {
        console.error('Fetch resources failed:', error);
        throw error;
    }
    },

  async searchResources(filters = {}) {
    const queryParams = new URLSearchParams();
    
    // Standard filters
    if (filters.name) queryParams.set('name', filters.name);
    if (filters.materialTypeId) queryParams.set('type', filters.materialTypeId);
    if (filters.startDate) queryParams.set('start_date', filters.startDate);
    if (filters.endDate) queryParams.set('end_date', filters.endDate);
    
    // Metadata filters
    if (filters.metadata) {
      Object.entries(filters.metadata).forEach(([field, value]) => {
        if (value) queryParams.set(`metadata[${field}]`, value);
      });
    }

    // Pagination
    if (filters.page) queryParams.set('page', filters.page);
    if (filters.perPage) queryParams.set('perPage', filters.perPage);

    try {
      const response = await fetch(`${API_BASE}/resource?${queryParams}`, {
        headers: {
          'Authorization': this.getAuthToken(),
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_SEARCH_FAILED);
      
      return {
        data: await response.json(),
        pagination: JSON.parse(response.headers.get('X-Pagination')) || {}
      };
    } catch (error) {
      console.error('Resource search failed:', error);
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_SEARCH_FAILED);
    }
  },

  async getResourceById(resourceId) {
    try {
      const response = await fetch(`${API_BASE}/resource/${resourceId}`, {
        headers: { 'Authorization': this.getAuthToken() }
      });
      
      if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
      
      return response.json();
    } catch (error) {
      console.error('Fetch resource failed:', error);
      throw error;
    }
  },

  async createResource(resourceData) {
    try {
      const response = await fetch(`${API_BASE}/resource`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthToken()
        },
        body: JSON.stringify(resourceData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || ADMIN_ERROR_MESSAGES.RESOURCE_CREATE_FAILED);
      }

      return response.json();
    } catch (error) {
      console.error('Create resource failed:', error);
      throw error;
    }
  },

  async updateResource(resourceId, updateData) {
    try {
      const response = await fetch(`${API_BASE}/resource/${resourceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthToken()
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_UPDATE_FAILED);
      
      return response.json();
    } catch (error) {
      console.error('Update resource failed:', error);
      throw error;
    }
  },

  async deleteResource(resourceId) {
    try {
      const response = await fetch(`${API_BASE}/resource/${resourceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': this.getAuthToken() }
      });

      if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_DELETE_FAILED);
      
      return true;
    } catch (error) {
      console.error('Delete resource failed:', error);
      throw error;
    }
  },

  async getMaterialTypes() {
    try {
      const response = await fetch(`${API_BASE}/material-type`, {
        headers: { 'Authorization': this.getAuthToken() }
      });
      
      if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.MATERIAL_TYPES_FETCH_FAILED);
      
      return response.json();
    } catch (error) {
      console.error('Fetch material types failed:', error);
      throw error;
    }
  },

  async updateResourceMetadata(resourceId, metadata) {
    try {
      const response = await fetch(`${API_BASE}/resource/${resourceId}/metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthToken()
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) throw new Error(ADMIN_ERROR_MESSAGES.METADATA_UPDATE_FAILED);
      
      return response.json();
    } catch (error) {
      console.error('Update metadata failed:', error);
      throw error;
    }
  }
};
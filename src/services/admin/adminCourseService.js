const API_BASE = 'https://libtools2.smith.edu/course-reserves/backend/web';
import { ADMIN_API_ENDPOINTS, ADMIN_ERROR_MESSAGES } from '../../constants/admin';

export const adminCourseService = {
  getAuthToken: () => `${localStorage.getItem('authToken')}`,

  async searchResources(searchTerm) {
    const response = await fetch(
      `${API_BASE}/course/search-resources?search=${encodeURIComponent(searchTerm)}`,
      {
        headers: { 'Authorization': this.getAuthToken() }
      }
    );
    if (!response.ok) throw new Error('Failed to search resources');
    return response.json();
  },


  async checkCourseExists(folioCourseId) {
    const response = await fetch(
      `${API_BASE}${ADMIN_API_ENDPOINTS.COURSE_EXISTS}?folioCourseId=${folioCourseId}`,
      {
        headers: {
          'Content-Type': 'application/json', 
          'Authorization': this.getAuthToken()
        }
      }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_CREATE_FAILED);
    }
    return response.json();
  },

  async createLocalCourse(data) {
    const response = await fetch(`${API_BASE}${ADMIN_API_ENDPOINTS.CREATE_COURSE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_CREATE_FAILED);
    }
    return response.json();
  },

  async fetchCourseResources(courseId) {
    const url = ADMIN_API_ENDPOINTS.COURSE_RESOURCES.replace(':id', courseId);
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
    }
    return response.json();
  },
  async searchEDS(searchTerm) {
    const response = await fetch(`${API_BASE}/ebsco-search/search?query=${encodeURIComponent(searchTerm)}`, {
      headers: { 'Authorization': this.getAuthToken() }
    });
    if (!response.ok) throw new Error('EDS search failed.');
    return response.json();
  },
  async createResource(courseId, formData) {
    const response = await fetch(
        `https://libtools2.smith.edu/course-reserves/backend/web/course/create-resource`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: JSON.stringify({ ...formData, courseId: courseId }), // Include courseId in the body
        }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_CREATE_FAILED);
    }
    return response.json();
  },

  async linkResource(courseId, resourceId) {
    const response = await fetch(
      `${API_BASE}${ADMIN_API_ENDPOINTS.LINK_RESOURCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ courseId, resourceId })
        }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_LINK_FAILED);
    }
    return response.json();
    },

    async getResourcesByCourse(courseId) {
        const response = await fetch(
            `${API_BASE}${ADMIN_API_ENDPOINTS.GET_RESOURCES_BY_COURSE}?courseListingId=${courseId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
        if (!response.ok) {
            throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
        }
        return response.json();
    },
    async deleteResourceLink(courseResourceId) {
        const response = await fetch(
            `${API_BASE}${ADMIN_API_ENDPOINTS.DELETE_RESOURCE_LINK}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
                body: JSON.stringify({ courseResourceId })
            }
        );
        if (!response.ok) {
            throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_DELETE_FAILED);
        }
        return response.json();
    },
    async updateResourceOrder(courseId, updatedResources) {
      const payload = {
        courseId,
        resources: updatedResources.map(resource => ({
          course_resource_id: resource.course_resource_id,
          order: resource.order,
        })),
      };
  
      const response = await fetch(`${API_BASE}${ADMIN_API_ENDPOINTS.UPDATE_RESOURCE_ORDER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_ORDER_UPDATE_FAILED || 'Failed to update resource order.');
      }
      return response.json();
    },
  
};

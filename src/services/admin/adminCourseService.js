import { ADMIN_ERROR_MESSAGES } from '../../constants/admin';
import { config } from '../../config';

const COURSE_API = config.api.urls.courseReserves;
const FOLIO_API = config.api.urls.folio;
const getAuthToken = config.api.getAuthToken;

export const adminCourseService = {
  getAuthToken: () => `${localStorage.getItem('authToken')}`,

// adminCourseService.js

async  checkPermanentCourseExists(courseData) {
  const response = await fetch(`${COURSE_API}${config.api.endpoints.course.exists}`, {
    method: 'POST',
    headers: {
      'Authorization': `${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(courseData),
  });

  if (!response.ok) {
    throw new Error('Error checking course existence.');
  }

  return response.json();
},

async reactivateCourse(params) {
  const response = await fetch(`${COURSE_API}${config.api.endpoints.course.reactivate}`, {
    method: 'POST',
    headers: {
      'Authorization': `${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
params
    }),
  });

  if (!response.ok) {
    throw new Error('Error reactivating the course.');
  }
  return response.json();
},

  async searchResources(searchTerm) {
    const response = await fetch(
      `${COURSE_API}${config.api.endpoints.course.searchResources}?search=${encodeURIComponent(searchTerm)}`,
      {
        headers: { 'Authorization': getAuthToken() }
      }
    );
    if (!response.ok) throw new Error('Failed to search resources');
    return response.json();
  },


  async checkCourseExists(folioCourseId) {
    const response = await fetch(
      `${COURSE_API}${config.api.endpoints.admin.courseExists}?folioCourseId=${folioCourseId}`,
      {
        headers: {
          'Content-Type': 'application/json', 
          'Authorization': getAuthToken()
        }
      }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_CREATE_FAILED);
    }
    return response.json();
  },

  async createLocalCourse(data) {
    const response = await fetch(`${COURSE_API}${config.api.endpoints.admin.createCourse}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${getAuthToken()}`,
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_CREATE_FAILED);
    }
    return response.json();
  },

  async fetchCourseResources(courseId) {
    const url = config.api.endpoints.admin.courseResources.replace(':id', courseId);
    const response = await fetch(`${COURSE_API}${url}`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
    }
    return response.json();
  },
  async searchEDS(searchTerm) {
    const response = await fetch(`${COURSE_API}${config.api.endpoints.ebsco.search}?query=${encodeURIComponent(searchTerm)}`, {
      headers: { 'Authorization': getAuthToken() }
    });
    if (!response.ok) throw new Error('EDS search failed.');
    return response.json();
  },
  async createResource(offering_id, courseId, formData, folioData) {
    const response = await fetch(
        `${COURSE_API}${config.api.endpoints.course.createResource}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${getAuthToken()}`,
            },
            body: JSON.stringify({ ...formData, courseId: courseId, offering_id: offering_id, folioData: folioData }), // Include courseId in the body
        }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_CREATE_FAILED);
    }
    return response.json();
  },

  async linkCourses(sourceId, targetId) {
    const response = await fetch(`${COURSE_API}${config.api.endpoints.offeringLink.create}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${getAuthToken()}`,
      },
      body: JSON.stringify({
        offering_id: sourceId,
        linked_offering_id: targetId
      })
    });
    if (!response.ok) throw new Error('Failed to link courses');
    return response.json();
  },
  async linkExistingResources(offeringId, resourceId){
    const response = await fetch(
      `${COURSE_API}${config.api.endpoints.offeringLink.linkExisting}?offering_id=${offeringId}&resource_id=${resourceId}`
    );
    if (!response.ok) throw new Error('Failed to link resources');
    return response.json();
  },
  async getLinkedCourses(courseId) {
    const response = await fetch(
      `${COURSE_API}${config.api.endpoints.offeringLink.findLinked}?offering_id=${courseId}`
    );
    if (!response.ok) throw new Error('Failed to find linked courses');
    return response.json();
  },

    async getResourcesByCourse(courseId) {
        const response = await fetch(
          `${COURSE_API}${config.api.endpoints.admin.getResourcesByCourse}?courseListingId=${courseId}`,
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
          `${COURSE_API}${config.api.endpoints.admin.deleteResourceLink}`,
          {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${getAuthToken()}`,
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
  
      const response = await fetch(`${COURSE_API}${config.api.endpoints.admin.updateResourceOrder}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_ORDER_UPDATE_FAILED || 'Failed to update resource order.');
      }
      return response.json();
    },
    async searchFolioCourses(searchTerm) {
      // This might call the same endpoint your front-end uses for searching in FOLIO
      const response = await fetch(
        `${FOLIO_API}${config.api.endpoints.folioSearch.courses}?query=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': getAuthToken(),
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) {
        throw new Error('Failed to search FOLIO courses');
      }
    
      // Suppose the response is something like { data: [ { folioCourseId:..., courseNumber:..., ...} ] }
      const result = await response.json();
      return result.data || [];
    },
    async getFolioCourseId(uuid){
      const response = await fetch(`${COURSE_API}${config.api.endpoints.course.checkUniqueId}?uuid=${uuid}`);
      if (!response.ok) {
        throw new Error('Error checking course existence.');
      }
      return response.json();
    },
    
  
};

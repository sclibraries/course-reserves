import { ADMIN_ERROR_MESSAGES } from '../../constants/admin';
import { config } from '../../config';

const COURSE_API = config.api.urls.courseReserves;
const FOLIO_API = config.api.urls.folio;
const getAuthToken = config.api.getAuthToken;

/**
 * Update the order of electronic resources
 * @param {string} offeringId - ID of the course offering
 * @param {Array} resources - Array of resources with order values
 * @returns {Promise} - Promise resolving to the update result
 */
const updateResourceOrder = async (offeringId, resources) => {
  try {
    console.log(`Updating resource order for offering ${offeringId}`, resources);
    
    const response = await fetch(`${config.api.urls.courseReserves}/offering-link/update-resource-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken()
      },
      body: JSON.stringify({
        offering_id: offeringId,
        resources: resources
      })
    });
    
    const responseText = await response.text();
    console.log('API raw response:', responseText);
    
    if (!response.ok) {
      throw new Error(`Failed to update resource order: ${responseText}`);
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.warn('Could not parse JSON response', e);
      result = { success: response.ok };
    }
    
    return result;
  } catch (error) {
    console.error('Error updating resource order:', error);
    throw error;
  }
};

/**
 * Update the order of physical resources
 * @param {string} offeringId - ID of the course offering
 * @param {Array} resources - Array of physical resources with order values
 * @returns {Promise} - Promise resolving to the update result
 */
const updatePhysicalResourceOrder = async (offeringId, resources) => {
  try {    
    const response = await fetch(`${config.api.urls.courseReserves}/physical-resource/update-resource-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken()
      },
      body: JSON.stringify({
        offering_id: offeringId,
        resources: resources
      })
    });
    
    const responseText = await response.text();
    console.log('API raw response:', responseText);
    
    if (!response.ok) {
      throw new Error(`Failed to update physical resource order: ${responseText}`);
    }
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.warn('Could not parse JSON response', e);
      result = { success: response.ok };
    }
    
    return result;
  } catch (error) {
    console.error('Error updating physical resource order:', error);
    throw error;
  }
};

/**
 * Update the global order of all resources (both electronic and physical)
 * This ensures consistent ordering between resource types
 * 
 * @param {string} offeringId - ID of the course offering
 * @param {Array} resources - Array of resources with resource_type, resource_id and order
 * @returns {Promise} - Promise resolving to the update result
 */
const updateGlobalResourceOrder = async (offeringId, resources) => {
  try {
    console.log(`Updating global resource order for offering ${offeringId}`, resources);
    
    const response = await fetch(`${config.api.urls.courseReserves}/resource/update-global-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken()
      },
      body: JSON.stringify({
        offering_id: offeringId,
        resources: resources.map(resource => ({
          resource_type: resource.resourceType, // 'electronic' or 'physical'
          resource_id: resource.resourceType === 'electronic' ? resource.resource_id : resource.id,
          order: resource.order
        }))
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update global resource order');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating global resource order:', error);
    throw error;
  }
};

/**
 * Get physical resource references for a course offering
 * 
 * @param {string} offeringId - The course offering ID to fetch references for
 * @returns {Promise<Array>} - Array of physical resource references
 */
const getPhysicalResourceReferences = async (offeringId) => {
  try {
    console.log(`Fetching physical resource references for offering ${offeringId}`);
    
    const response = await fetch(`${config.api.urls.courseReserves}/physical-resource/get-references?offering_id=${offeringId}`, {
      headers: {
        'Authorization': getAuthToken(),
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch physical resource references');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching physical resource references:', error);
    throw error;
  }
};

/**
 * Get physical resource by external ID
 * 
 * @param {string} externalId - The external ID of the physical resource
 * @param {string} [offeringId] - Optional offering ID to scope the query
 * @returns {Promise<Object>} - Physical resource data
 */
const getPhysicalResourceByExternalId = async (externalId, offeringId = null) => {
  try {
    let url = `${config.api.urls.courseReserves}/physical-resource/by-external-id/${externalId}`;
    if (offeringId) {
      url += `?offering_id=${offeringId}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthToken(),
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch physical resource by external ID');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching physical resource by external ID:', error);
    throw error;
  }
};

export const adminCourseService = {
  getAuthToken: () => `${localStorage.getItem('authToken')}`,

  async checkPermanentCourseExists(courseData) {
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
  
  async getPhysicalResourceReferences(offeringId) {
    try {
      const response = await fetch(`${config.api.urls.courseReserves}/physical-resource/get-references?offering_id=${offeringId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthToken()
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch physical resource references');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching physical resource references:', error);
      throw error;
    }
  },

  getPhysicalResourceReferences,
  getPhysicalResourceByExternalId,
  updateResourceOrder,
  updatePhysicalResourceOrder,
  updateGlobalResourceOrder,
};

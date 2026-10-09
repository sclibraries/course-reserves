import { ADMIN_ERROR_MESSAGES } from '../../constants/admin';
import { config } from '../../config';

const COURSE_API = config.api.urls.courseReserves;
const FOLIO_API = config.api.urls.folio;
const getAuthToken = config.api.getAuthToken;

const SANDBOX_COURSE_IDENTIFIERS = [
  'TST 101',
  'Sandbox Course Reserves Workflow',
  'sandbox-folio-course-001',
  'sandbox-term-2026',
  'SANDBOX-2026',
];

const isSandboxCourseSearch = (query) => {
  if (!query) return false;
  return SANDBOX_COURSE_IDENTIFIERS.some((identifier) => query.includes(identifier));
};

const getCourseSearchUrl = (query, cql) => {
  if (isSandboxCourseSearch(query) || isSandboxCourseSearch(cql)) {
    return `${COURSE_API}/sandbox-folio/search-courses?query=${encodeURIComponent(cql)}`;
  }

  return `${FOLIO_API}${config.api.endpoints.folioSearch.courses}?query=${encodeURIComponent(cql)}`;
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
  getAuthToken: () => config.api.getAuthToken(),

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
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_EXISTS_CHECK_FAILED || 'Failed to check if course exists');
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
      body: JSON.stringify({
        course: data.course,
        offering: data.offering
      })
    });
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_CREATE_FAILED);
    }
    return response.json();
  },

  async createFromFolio(courseData, offeringData) {
    const response = await fetch(`${COURSE_API}${config.api.endpoints.admin.createCourse}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${getAuthToken()}`,
      },
      body: JSON.stringify({
        course: courseData,
        offering: offeringData
      })
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

  async unlinkCourses(offeringLinkId) {
    // Use the offering_link_id in the URL path as expected by the backend
    const url = `${COURSE_API}${config.api.endpoints.offeringLink.delete}/${offeringLinkId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${getAuthToken()}`,
      }
      // No body needed - the link ID is in the URL path
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to unlink courses: ${response.status} ${errorText}`);
    }
    
    // Handle empty response (204 No Content)
    if (response.status === 204) {
      return { success: true };
    }
    
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

    console.log('updateResourceOrder: Sending payload', JSON.stringify(payload, null, 2));

    const response = await fetch(`${COURSE_API}${config.api.endpoints.admin.updateResourceOrder}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${getAuthToken()}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('updateResourceOrder: Response status', response.status, response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('updateResourceOrder: Error response', errorText);
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_ORDER_UPDATE_FAILED || 'Failed to update resource order.');
    }
    return response.json();
  },

  async searchCoursesByQuery(query) {
    // Strictly remove leading wildcards to prevent CQL errors
    const safeQuery = query.replace(/^\*+/, '');
    
    // Construct CQL with trailing wildcards only
    const cql = `(name="${safeQuery}*" or courseNumber="${safeQuery}*")`;
    
    const response = await fetch(getCourseSearchUrl(safeQuery, cql));
    
    if (!response.ok) {
      // Return empty array on 400 errors to prevent UI crashes, log the error
      if (response.status === 400) {
        console.warn('CQL Search Error:', await response.text());
        return [];
      }
      throw new Error('Failed to search FOLIO courses');
    }

    const result = await response.json();
    return result.data || [];
  },

  async searchFolioCourses(searchTerm) {
    const response = await fetch(
      `${FOLIO_API}${config.api.endpoints.folioSearch.courses}?query=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
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

  async getFolioCourseId(uuid, section = null){
    let url = `${COURSE_API}${config.api.endpoints.course.checkUniqueId}?uuid=${uuid}`;
    if (section) {
      url += `&section=${encodeURIComponent(section)}`;
    }
    const response = await fetch(url);
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

  async cleanupPhysicalResourceReferences(offeringId, folioResourceIds) {
    try {
      const response = await fetch(`${config.api.urls.courseReserves}/physical-resource/cleanup-references`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthToken()
        },
        body: JSON.stringify({
          offering_id: offeringId,
          folio_resource_ids: folioResourceIds
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to cleanup physical resource references');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error cleaning up physical resource references:', error);
      throw error;
    }
  },

  async provisionCourseFromFolio(courseDetails, localCourseData) {
    try {
      // 1. Check if permanent course exists
      const checkResponse = await this.checkPermanentCourseExists({
        course_name: courseDetails?.name,
        course_number: courseDetails?.courseNumber,
        department_id: courseDetails?.departmentId,
        folio_course_id: courseDetails?.courseListingId,
        term_id: courseDetails?.courseListingObject?.termId,
        section_name: courseDetails?.sectionName 
             || courseDetails?.courseListingObject?.sectionName 
             || ''
      });

      if (checkResponse.exists) {
        // Course exists, return existing data
        return {
          offering_id: checkResponse.offeringId,
          course: checkResponse.course,
          is_created: false
        };
      } else {
        // 2. Create new course if missing
        if (!localCourseData) {
          throw new Error('Course does not exist and no local data provided for creation');
        }
        
        const newCourse = await this.createLocalCourse(localCourseData);
        
        return {
          offering_id: newCourse.offering.offering_id,
          course: newCourse.course,
          is_created: true
        };
      }
    } catch (error) {
      console.error('Error provisioning course from FOLIO:', error);
      throw error;
    }
  },

  async linkCourseOffering(submissionId, selectedCourse) {
    const response = await fetch(`${COURSE_API}${config.api.endpoints.admin.linkCourseOffering}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthToken(),
      },
      body: JSON.stringify({
        submission_id: submissionId,
        selectedCourse: selectedCourse
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to link course offering' }));
      throw new Error(errorData.message || 'Failed to link course offering');
    }
    
    return response.json();
  },

  // Functions imported at top of file
  getPhysicalResourceByExternalId,
  updatePhysicalResourceOrder,
  updateGlobalResourceOrder,
};

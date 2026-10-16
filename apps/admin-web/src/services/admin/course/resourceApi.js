import { ADMIN_ERROR_MESSAGES } from '../../../constants/admin';
import { config } from '../../../config';
import { authFetch } from '../../http/authFetch';

const COURSE_API = config.api.urls.courseReserves;

export function getEdsSearchErrorMessage(status = 0, errorCode) {
  if (status === 503 && errorCode === 'search_unavailable') {
    return 'Library search is temporarily unavailable. Please try again later, or add the item by citation.';
  }
  if (status === 429) {
    return 'There are too many searches right now. Please wait a moment and try again.';
  }
  return 'Unable to search the library right now. Please try again.';
}

async function fetchEdsSearch(url) {
  let response;
  try {
    response = await authFetch(url, { headers: {} });
  } catch {
    throw new Error(getEdsSearchErrorMessage());
  }

  let data;
  if (!response.ok) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    throw new Error(getEdsSearchErrorMessage(response.status, data?.error_code));
  }

  try {
    data = await response.json();
  } catch {
    throw new Error(getEdsSearchErrorMessage());
  }
  return data;
}

export const resourceApi = {
  async searchResources(searchTerm) {
    const response = await authFetch(
      `${COURSE_API}${config.api.endpoints.course.searchResources}?search=${encodeURIComponent(searchTerm)}`,
      { headers: {} }
    );
    if (!response.ok) throw new Error('Failed to search resources');
    return response.json();
  },

  async fetchCourseResources(courseId) {
    const url = config.api.endpoints.admin.courseResources.replace(':id', courseId);
    const response = await authFetch(`${COURSE_API}${url}`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
    }
    return response.json();
  },

  async searchEDS(searchTerm) {
    return fetchEdsSearch(
      `${COURSE_API}${config.api.endpoints.ebsco.search}?query=${encodeURIComponent(searchTerm)}`
    );
  },

  async searchEDSPage(queryString, page) {
    const action = encodeURIComponent(`GoToPage(${page})`);
    return fetchEdsSearch(
      `${COURSE_API}${config.api.endpoints.ebsco.search}?query=${encodeURIComponent(queryString)}&action=${action}`
    );
  },

  async createResource(offering_id, courseId, formData, folioData) {
    const response = await authFetch(
      `${COURSE_API}${config.api.endpoints.course.createResource}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, courseId: courseId, offering_id: offering_id, folioData: folioData }),
      }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.RESOURCE_CREATE_FAILED);
    }
    return response.json();
  },

  async getResourcesByCourse(courseId) {
    const response = await authFetch(
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
    const response = await authFetch(
      `${COURSE_API}${config.api.endpoints.admin.deleteResourceLink}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    const response = await authFetch(`${COURSE_API}${config.api.endpoints.admin.updateResourceOrder}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
};

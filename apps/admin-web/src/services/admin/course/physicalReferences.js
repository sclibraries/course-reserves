import { config } from '../../../config';
import { authFetch } from '../../http/authFetch';

const updatePhysicalResourceOrder = async (offeringId, resources) => {
  try {
    const response = await authFetch(`${config.api.urls.courseReserves}/physical-resource/update-resource-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

const updateGlobalResourceOrder = async (offeringId, resources) => {
  try {
    console.log(`Updating global resource order for offering ${offeringId}`, resources);

    const response = await authFetch(`${config.api.urls.courseReserves}/resource/update-global-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offering_id: offeringId,
        resources: resources.map(resource => ({
          resource_type: resource.resourceType,
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

const getPhysicalResourceByExternalId = async (externalId, offeringId = null) => {
  try {
    let url = `${config.api.urls.courseReserves}/physical-resource/by-external-id/${externalId}`;
    if (offeringId) {
      url += `?offering_id=${offeringId}`;
    }

    const response = await authFetch(url, {
      headers: {
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

export const physicalReferences = {
  async getPhysicalResourceReferences(offeringId) {
    try {
      const response = await authFetch(`${config.api.urls.courseReserves}/physical-resource/get-references?offering_id=${offeringId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
      const response = await authFetch(`${config.api.urls.courseReserves}/physical-resource/cleanup-references`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

  getPhysicalResourceByExternalId,
  updatePhysicalResourceOrder,
  updateGlobalResourceOrder,
};

import { config } from '../../../config';
import { authFetch } from '../../http/authFetch';

const COURSE_API = config.api.urls.courseReserves;

export const offeringLinkApi = {
  async linkCourses(sourceId, targetId) {
    const response = await authFetch(`${COURSE_API}${config.api.endpoints.offeringLink.create}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const url = `${COURSE_API}${config.api.endpoints.offeringLink.delete}/${offeringLinkId}`;

    const response = await authFetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to unlink courses: ${response.status} ${errorText}`);
    }

    if (response.status === 204) {
      return { success: true };
    }

    return response.json();
  },

  async linkExistingResources(offeringId, resourceId) {
    const response = await authFetch(
      `${COURSE_API}${config.api.endpoints.offeringLink.linkExisting}?offering_id=${offeringId}&resource_id=${resourceId}`,
      { headers: {} }
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
};

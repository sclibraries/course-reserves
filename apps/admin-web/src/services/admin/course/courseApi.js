import { ADMIN_ERROR_MESSAGES } from '../../../constants/admin';
import { config } from '../../../config';
import { authFetch } from '../../http/authFetch';

const COURSE_API = config.api.urls.courseReserves;

export const courseApi = {
  async checkPermanentCourseExists(courseData) {
    const response = await authFetch(`${COURSE_API}${config.api.endpoints.course.exists}`, {
      method: 'POST',
      headers: {
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
    const response = await authFetch(`${COURSE_API}${config.api.endpoints.course.reactivate}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      throw new Error('Error reactivating the course.');
    }
    return response.json();
  },

  async checkCourseExists(folioCourseId) {
    const response = await authFetch(
      `${COURSE_API}${config.api.endpoints.admin.courseExists}?folioCourseId=${folioCourseId}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) {
      throw new Error(ADMIN_ERROR_MESSAGES.COURSE_EXISTS_CHECK_FAILED || 'Failed to check if course exists');
    }
    return response.json();
  },

  async createLocalCourse(data) {
    const response = await authFetch(`${COURSE_API}${config.api.endpoints.admin.createCourse}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const response = await authFetch(`${COURSE_API}${config.api.endpoints.admin.createCourse}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

  async provisionCourseFromFolio(courseDetails, localCourseData) {
    try {
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
        return {
          offering_id: checkResponse.offeringId,
          course: checkResponse.course,
          is_created: false
        };
      }

      if (!localCourseData) {
        throw new Error('Course does not exist and no local data provided for creation');
      }

      const newCourse = await this.createLocalCourse(localCourseData);

      return {
        offering_id: newCourse.offering.offering_id,
        course: newCourse.course,
        is_created: true
      };
    } catch (error) {
      console.error('Error provisioning course from FOLIO:', error);
      throw error;
    }
  },

  async linkCourseOffering(submissionId, selectedCourse) {
    const response = await authFetch(`${COURSE_API}${config.api.endpoints.admin.linkCourseOffering}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
};

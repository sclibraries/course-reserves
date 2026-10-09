// src/store/adminCourseStore.js
import {create} from 'zustand';

/**
 * useAdminCourseStore
 * --------------------
 * This store manages shared course data and related properties such as folio course data
 * and term start/end dates. This centralizes data so that modals and other components
 * can access and update course-level information without excessive prop drilling.
 *
 * Usage:
 * const { course, folioCourseData, termStart, termEnd, setCourse, setFolioCourseData, clearCourse } = useAdminCourseStore();
 */
export const useAdminCourseStore = create((set) => ({
  // Shared state
  course: null,
  folioCourseData: null,
  termStart: null,
  termEnd: null,

  // Action to update the course and extract term dates from the course data.
  setCourse: (course) => {
    set(() => ({
      course,
      // Assuming term dates are on the course object in courseListingObject.termObject
      termStart: course?.courseListingObject?.termObject?.startDate || null,
      termEnd: course?.courseListingObject?.termObject?.endDate || null,
    }));
  },

  // Action to update the folio course data and extract term dates.
  setFolioCourseData: (data) => {
    set(() => ({
      folioCourseData: data,
      termStart: data?.courseListingObject?.termObject?.startDate || null,
      termEnd: data?.courseListingObject?.termObject?.endDate || null,
    }));
  },

  // Optionally, clear the course data.
  clearCourse: () =>
    set(() => ({
      course: null,
      folioCourseData: null,
      termStart: null,
      termEnd: null,
    })),
}));

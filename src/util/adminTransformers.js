/**
 * Transforms a FOLIO course object into local data for both the Courses
 * and the CourseOfferings tables.
 *
 * The returned object has two properties:
 *  - course: Data to be saved in the static Courses table.
 *  - offering: Data to be saved in the term-specific course_offerings table.
 *
 * @param {Object} folioCourse - A course object as returned by the FOLIO API.
 * @returns {Object} The transformed data.
 */
export const transformFolioCourseToLocal = (folioCourse) => {
  return {
    // Static course information (Courses table)
    course: {
      // Use the courseListingId as the unique identifier from FOLIO.
      folio_course_id: folioCourse.courseListingId,
      course_name: folioCourse.name,
      course_number: folioCourse.courseNumber,
      department_id: folioCourse.departmentId,
      // Safely access the department name.
      department_name: folioCourse.departmentObject?.name || '',
      // Location data is part of the courseListingObject.
      location_id: folioCourse.courseListingObject?.locationId || '',
      location_name: folioCourse.courseListingObject?.locationObject?.name || '',
    },
    // Term-specific offering information (course_offerings table)
    offering: {
      // Map the term-related data from the courseListingObject.
      term_id: folioCourse.courseListingObject?.termId || '',
      term_name: folioCourse.courseListingObject?.termObject?.name || '',
      // Use the provided ISO date strings directly or perform any additional formatting if needed.
      start_date: folioCourse.courseListingObject?.termObject?.startDate || null,
      end_date: folioCourse.courseListingObject?.termObject?.endDate || null,
      // Set the default status for a new offering. You can modify this as needed.
      status: 'active',
    }
  };
};

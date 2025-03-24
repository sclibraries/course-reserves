/**
 * @file Common type definitions for course-related data structures
 * @module courseTypes
 * @description Centralized PropTypes definitions for courses and related entities
 */

import PropTypes from 'prop-types';

/**
 * PropTypes shape definition for a standard course object
 */
export const courseShape = PropTypes.shape({
  id: PropTypes.string,
  name: PropTypes.string,
  courseNumber: PropTypes.string,
  departmentObject: PropTypes.shape({
    name: PropTypes.string,
  }),
  courseListingObject: PropTypes.shape({
    id: PropTypes.string,
    courseTypeObject: PropTypes.shape({
      name: PropTypes.string,
      description: PropTypes.string,
    }),
    instructorObjects: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
    })),
    termObject: PropTypes.shape({
      name: PropTypes.string,
      startDate: PropTypes.string,
      endDate: PropTypes.string,
    }),
    locationObject: PropTypes.shape({
      name: PropTypes.string,
      code: PropTypes.string,
    }),
  }),
});
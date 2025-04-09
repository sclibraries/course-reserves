/**
 * Utility functions for building URLs used throughout the application
 */

/**
 * Builds a permalink URL for a course
 * @param {string} permanentCourseUuid - The permanent UUID of the course
 * @returns {string} The full permalink URL
 */
export const buildCoursePermalink = (permanentCourseUuid) => {
  if (!permanentCourseUuid) return '';
  return `${window.location.origin}/course-reserves/records/${permanentCourseUuid}`;
};

/**
 * Builds a URL to view a course in FOLIO
 * @param {string} folioId - The ID of the course in FOLIO
 * @returns {string} The full FOLIO course URL
 */
export const buildFolioCourseUrl = (folioId) => {
  if (!folioId) return '';
  return `https://fivecolleges.folio.ebsco.com/cr/courses/${folioId}`;
};

/**
 * Builds a URL for the public course reserves page
 * @param {string} courseListingId - The course listing ID
 * @returns {string} The full public course reserves URL
 */
export const buildPublicCourseUrl = (courseListingId) => {
  if (!courseListingId) return '';
  return `/course-reserves/records?courseListingId=${courseListingId}`;
};

/**
 * Builds a URL to verify a FOLIO record
 * @param {string} instanceId - The instance ID in FOLIO
 * @param {string} holdingsId - The holdings ID in FOLIO
 * @returns {string} The verification URL
 */
export const buildFolioVerificationUrl = (instanceId, holdingsId) => {
  if (!instanceId || !holdingsId) return '';
  return `https://fivecolleges.folio.ebsco.com/inventory/view/${instanceId}/${holdingsId}`;
};

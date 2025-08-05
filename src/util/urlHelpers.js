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
 * Creates a URL-safe slug from a string
 * @param {string} text - The text to convert to a slug
 * @returns {string} URL-safe slug
 */
export const createSlug = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Builds a user-friendly URL for course materials
 * @param {Object} course - The course object
 * @param {string} course.courseNumber - Course number (e.g., "CSC 101")
 * @param {string} course.name - Course name
 * @param {Object} course.courseListingObject - Course listing details
 * @param {string} course.courseListingId - Course listing ID (for fallback)
 * @returns {string} User-friendly course URL
 */
export const buildFriendlyCourseUrl = (course) => {
  if (!course) return '';
  
  try {
    const { courseNumber, name, courseListingObject, courseListingId } = course;
    const termName = courseListingObject?.termObject?.name;
    
    if (courseNumber && name && termName) {
      // Create slugs for each component
      const courseSlug = createSlug(courseNumber);
      const nameSlug = createSlug(name);
      const termSlug = createSlug(termName);
      
      // Build the friendly URL: /course/{term}/{course-number}/{course-name}?id={courseListingId}
      return `/course/${termSlug}/${courseSlug}/${nameSlug}?id=${courseListingId}`;
    }
  } catch (error) {
    console.warn('Error building friendly course URL:', error);
  }
  
  // Fallback to standard URL if friendly URL construction fails
  return buildPublicCourseUrl(course.courseListingId);
};

/**
 * Builds a shareable URL for course materials with the full base path
 * @param {Object} course - The course object
 * @param {string} course.courseNumber - Course number (e.g., "CSC 101")
 * @param {string} course.name - Course name
 * @param {Object} course.courseListingObject - Course listing details
 * @param {string} course.courseListingId - Course listing ID (for fallback)
 * @returns {string} Full shareable course URL with base path
 */
export const buildShareableCourseUrl = (course) => {
  if (!course) return '';
  
  try {
    const { courseNumber, name, courseListingObject, courseListingId } = course;
    const termName = courseListingObject?.termObject?.name;
    
    if (courseNumber && name && termName) {
      // Create slugs for each component
      const courseSlug = createSlug(courseNumber);
      const nameSlug = createSlug(name);
      const termSlug = createSlug(termName);
      
      // Build the shareable URL with base path: /course-reserves/course/{term}/{course-number}/{course-name}?id={courseListingId}
      return `/course-reserves/course/${termSlug}/${courseSlug}/${nameSlug}?id=${courseListingId}`;
    }
  } catch (error) {
    console.warn('Error building shareable course URL:', error);
  }
  
  // Fallback to standard URL if friendly URL construction fails
  return `/course-reserves${buildPublicCourseUrl(course.courseListingId)}`;
};

/**
 * Parses a friendly course URL to extract the course listing ID
 * @param {string} pathname - The URL pathname
 * @param {string} search - The URL search parameters
 * @returns {string|null} The course listing ID if found
 */
export const parseFriendlyCourseUrl = (pathname, search) => {
  try {
    // Check if this is a friendly URL pattern
    if (pathname.startsWith('/course/') || pathname.startsWith('/course-reserves/course/')) {
      const searchParams = new URLSearchParams(search);
      return searchParams.get('id');
    }
    
    // Check for traditional query parameter
    if (pathname === '/course-reserves/records' || pathname === '/records') {
      const searchParams = new URLSearchParams(search);
      return searchParams.get('courseListingId');
    }
    
    return null;
  } catch (error) {
    console.warn('Error parsing friendly course URL:', error);
    return null;
  }
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

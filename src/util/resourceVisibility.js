/**
 * Utility functions for handling resource visibility logic
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a visibility boundary without converting date-only values to UTC.
 * Timestamp values keep their exact time and timezone semantics.
 *
 * @param {string|Date|null} value - Visibility boundary value
 * @param {'start'|'end'} boundary - Boundary side to parse
 * @returns {Date|null} Parsed boundary, or null when absent/invalid
 */
export const parseVisibilityDate = (value, boundary = 'start') => {
  if (!value) return null;

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(
      DATE_ONLY_PATTERN.test(value)
        ? `${value}T${boundary === 'end' ? '23:59:59.999' : '00:00:00.000'}`
        : value
    );

  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Check if a primary resource link is visible based on visibility settings
 * 
 * @param {Object} resource - The resource object containing visibility settings
 * @param {boolean} canBypassVisibility - Whether visibility restrictions can be bypassed
 * @returns {boolean} Whether the primary link should be visible
 */
export const isPrimaryLinkVisible = (resource, canBypassVisibility) => {
  if (canBypassVisibility) return true;
  
  // If no resource, no link is visible
  if (!resource) return false;
  
  const now = new Date();
  
  // Check if primary link visibility is enabled
  const usePrimaryLinkVisibility = resource.use_primary_link_visibility === "1" || 
                                 resource.use_primary_link_visibility === 1 || 
                                 resource.use_primary_link_visibility === true;
  
  if (usePrimaryLinkVisibility) {
    // Use primary link visibility dates
    const startVisibility = parseVisibilityDate(resource.primary_link_start_visibility);
    const endVisibility = parseVisibilityDate(resource.primary_link_end_visibility, 'end');
      
    // If current time is before the start of the primary link visibility window
    if (startVisibility && now < startVisibility) {
      return false;
    }
    
    // If current time is after the end of the primary link visibility window
    if (endVisibility && now > endVisibility) {
      return false;
    }
  } else {
    // Check if resource-level visibility is enabled
    const useResourceVisibility = resource.use_resource_visibility === "1" || 
                                 resource.use_resource_visibility === 1 || 
                                 resource.use_resource_visibility === true;
    
    // Only apply resource-level visibility dates if resource visibility is enabled
    if (useResourceVisibility) {
      const startVisibility = parseVisibilityDate(resource.start_visibility);
      const endVisibility = parseVisibilityDate(resource.end_visibility, 'end');
        
      // If current time is before the start of the visibility window
      if (startVisibility && now < startVisibility) {
        return false;
      }
      
      // If current time is after the end of the visibility window
      if (endVisibility && now > endVisibility) {
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Check if an individual resource link is visible based on its visibility settings
 * 
 * @param {Object} link - The link object containing visibility settings
 * @param {boolean} canBypassVisibility - Whether visibility restrictions can be bypassed
 * @returns {boolean} Whether the link should be visible
 */
export const isLinkVisible = (link, canBypassVisibility) => {
  if (canBypassVisibility) return true;
  
  // If no link, it's not visible
  if (!link) return false;
  
  const useLinkVisibility = link.use_link_visibility === true || 
                          link.use_link_visibility === "1" || 
                          link.use_link_visibility === 1;
  
  // If no visibility settings, show link
  if (!useLinkVisibility) return true;
  
  const now = new Date();
  const linkStartDate = parseVisibilityDate(link.start_visibility);
  const linkEndDate = parseVisibilityDate(link.end_visibility, 'end');
  
  if (linkStartDate && now < linkStartDate) return false;
  if (linkEndDate && now > linkEndDate) return false;
  
  return true;
};

/**
 * Get visibility information for displaying to authenticated users
 * 
 * @param {Object} resource - The resource object containing visibility settings
 * @param {boolean} canBypassVisibility - Whether visibility restrictions can be bypassed
 * @returns {Object} Object containing visibility date information
 */
export const getVisibilityInfo = (resource, canBypassVisibility) => {
  if (!canBypassVisibility || !resource) {
    return { showVisibilityDates: false };
  }

  const usePrimaryLinkVisibility = resource.use_primary_link_visibility === "1" || 
                                 resource.use_primary_link_visibility === 1 || 
                                 resource.use_primary_link_visibility === true;
  
  const useResourceVisibility = resource.use_resource_visibility === "1" || 
                              resource.use_resource_visibility === 1 || 
                              resource.use_resource_visibility === true;
  
  const showVisibilityDates = usePrimaryLinkVisibility ? 
    (resource.primary_link_start_visibility || resource.primary_link_end_visibility) :
    (useResourceVisibility && (resource.start_visibility || resource.end_visibility));

  return {
    showVisibilityDates,
    usePrimaryLinkVisibility,
    useResourceVisibility,
    startDate: usePrimaryLinkVisibility ? resource.primary_link_start_visibility : resource.start_visibility,
    endDate: usePrimaryLinkVisibility ? resource.primary_link_end_visibility : resource.end_visibility
  };
};

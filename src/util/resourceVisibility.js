/**
 * Utility functions for handling resource visibility logic
 */

/**
 * Check if a primary resource link is visible based on visibility settings
 * 
 * @param {Object} resource - The resource object containing visibility settings
 * @param {boolean} isAuthenticated - Whether the user is authenticated
 * @returns {boolean} Whether the primary link should be visible
 */
export const isPrimaryLinkVisible = (resource, isAuthenticated) => {
  // Authenticated users see all links
  if (isAuthenticated) return true;
  
  // If no resource, no link is visible
  if (!resource) return false;
  
  const now = new Date();
  
  // Check if primary link visibility is enabled
  const usePrimaryLinkVisibility = resource.use_primary_link_visibility === "1" || 
                                 resource.use_primary_link_visibility === 1 || 
                                 resource.use_primary_link_visibility === true;
  
  if (usePrimaryLinkVisibility) {
    // Use primary link visibility dates
    const startVisibility = resource.primary_link_start_visibility
      ? new Date(resource.primary_link_start_visibility)
      : null;
    const endVisibility = resource.primary_link_end_visibility
      ? new Date(resource.primary_link_end_visibility)
      : null;
      
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
      const startVisibility = resource.start_visibility
        ? new Date(resource.start_visibility)
        : null;
      const endVisibility = resource.end_visibility
        ? new Date(resource.end_visibility)
        : null;
        
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
 * @param {boolean} isAuthenticated - Whether the user is authenticated
 * @returns {boolean} Whether the link should be visible
 */
export const isLinkVisible = (link, isAuthenticated) => {
  // Authenticated users see all links
  if (isAuthenticated) return true;
  
  // If no link, it's not visible
  if (!link) return false;
  
  const useLinkVisibility = link.use_link_visibility === true || 
                          link.use_link_visibility === "1" || 
                          link.use_link_visibility === 1;
  
  // If no visibility settings, show link
  if (!useLinkVisibility) return true;
  
  const now = new Date();
  const linkStartDate = link.start_visibility ? new Date(link.start_visibility) : null;
  const linkEndDate = link.end_visibility ? new Date(link.end_visibility) : null;
  
  if (linkStartDate && now < linkStartDate) return false;
  if (linkEndDate && now > linkEndDate) return false;
  
  return true;
};

/**
 * Get visibility information for displaying to authenticated users
 * 
 * @param {Object} resource - The resource object containing visibility settings
 * @param {boolean} isAuthenticated - Whether the user is authenticated
 * @returns {Object} Object containing visibility date information
 */
export const getVisibilityInfo = (resource, isAuthenticated) => {
  if (!isAuthenticated || !resource) {
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

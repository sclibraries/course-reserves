export const MATERIAL_TYPES = {
    WEBSITE: 'Website',
    PDF: 'PDF',
    VIDEO: 'Video'
  };
  
  export const ADMIN_API_ENDPOINTS = {
    COURSE_EXISTS: '/course/exists',
    CREATE_COURSE: '/course/create-from-folio',
    COURSE_RESOURCES: '/course/:id/resources',
    CREATE_RESOURCE: '/course/:id/create-resource',
    SEARCH_RESOURCES: '/course/search-resources',
    LINK_RESOURCE: '/course/link-resource',
    GET_RESOURCES_BY_COURSE: '/course/get-resources',
    DELETE_RESOURCE_LINK: '/course/unlink-resource',
    UPDATE_RESOURCE_ORDER: '/course/update-resource-order',
  };
  
  export const ADMIN_ERROR_MESSAGES = {
    COURSE_CREATE_FAILED: 'Failed to create local course',
    RESOURCE_FETCH_FAILED: 'Failed to fetch course resources',
    RESOURCE_CREATE_FAILED: 'Failed to create resource',
    RESOURCE_LINK_FAILED: 'Failed to link resource',
    RESOURCE_SEARCH_FAILED: 'Failed to search resources',
  };
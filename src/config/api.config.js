import { defaults } from './defaults';

// Read from environment variables if available (for production builds)
const BASE_API_URL = import.meta.env.VITE_BASE_API_URL || defaults.api.baseUrl;
const COURSE_RESERVES_PATH = import.meta.env.VITE_COURSE_RESERVES_PATH || defaults.api.endpoints.courseReserves;
const FOLIO_PATH = import.meta.env.VITE_FOLIO_PATH || defaults.api.endpoints.folio;
const AUTH_PATH = import.meta.env.VITE_AUTH_PATH || defaults.api.endpoints.auth;
const FOLIO_BASE_URL = import.meta.env.VITE_FOLIO_BASE_URL || defaults.api.folioBaseApplication;

export const apiConfig = {
  baseUrl: BASE_API_URL,
  folioBaseUrl: FOLIO_BASE_URL,
  urls: {
    courseReserves: `${BASE_API_URL}${COURSE_RESERVES_PATH}`,
    folio: `${BASE_API_URL}${FOLIO_PATH}`,
    auth: `${BASE_API_URL}${AUTH_PATH}`
  },
  endpoints: {
    auth: {
        refreshToken: '/admin/refresh-token',
        login: '/admin/login',
        developmentLogin: '/authorize-dev.php',
        productionLogin: '/authorize.php',
    },
    folioApplicationEndpoints: {
        courses: '/cr/courses/',
    },
    admin: {
        courseExists: '/course/exists',
        createCourse: '/course/create-from-folio',
        courseResources: '/course/:id/resources',
        createResource: '/course/:id/create-resource',
        searchResources: '/course/search-resources',
        linkResource: '/course/link-resource',
        getResourcesByCourse: '/course/get-resources',
        deleteResourceLink: '/course/unlink-resource', 
        updateResourceOrder: '/course/update-resource-order',
        reports: "/tracking"
    },    
    course: {
      exists: '/course/check-course-exists',
      reactivate: '/course/reactivate-course',
      searchResources: '/course/search-resources',
      createResource: '/course/create-resource',
      resources: '/course/resources/:id',
      checkUniqueId: '/course/check-unique-id',
      create: '/course/create',
    },
    folder:{
        base: '/folder',
    },
    ebsco: {
      search: '/ebsco-search/search',
    },
    offeringLink: {
      create: '/offering-link',
      findLinked: '/offering-link/find-linked-offerings',
      linkExisting: '/offering-link/link-existing-resources',
    },
    folioSearch: {
      courses: '/search/search-courses',
      departments: '/search/search-departments',
    },
    customizations: {
      getCustomizations: '/college-customization',
      updateCustomizations: '/college-customization',
    }
  },
  environment: import.meta.env.MODE || 'development',
  getAuthUrl: function() {
    const authEndpoint = this.environment === 'production' 
      ? this.endpoints.auth.productionLogin 
      : this.endpoints.auth.developmentLogin;
    
    return `${this.urls.auth}${authEndpoint}`;
  },
  getAuthToken: function() {
    const token = localStorage.getItem('authToken');
    return token ? `Bearer ${token}` : '';
  },
};
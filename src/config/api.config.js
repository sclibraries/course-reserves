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
        refreshToken: '/refresh-token.php',
        developmentRefreshToken: '/refresh-token-dev.php',
        login: '/admin/login',
        developmentLogin: '/authorize-dev.php',
        productionLogin: '/authorize.php',
        register: '/registration/register'
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
    users: {
      list: '/user',
      pending: '/user/pending',
      approve: '/user/approve/', 
      reject: '/user/reject/', 
      view: '/user/', 
      viewByUsername: '/user/username/',
      me: 'user/ne',
      update: '/user/', 
      current: '/user/current'
    },
    permissions: {
      grouped: '/permission/grouped',
      available: '/permission/available',
      toggle: '/permission/toggle/',
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
      delete: '/offering-link',
      findLinked: '/offering-link/find-linked-offerings',
      linkExisting: '/offering-link/link-existing-resources',
    },
    folioSearch: {
      courses: '/search/search-courses',
      departments: '/search/search-departments',
      reservesWithCourses: '/search/search-reserves-with-courses',
    },
    customizations: {
      getCustomizations: '/college-customization',
      updateCustomizations: '/college-customization',
    },
    submissionWorkflow: {
      pendingSubmissions: '/submission-workflow/pending-submissions',
      submissionDetail: '/submission-workflow/submission/:id',
      lockSubmission: '/faculty-submission/:uuid/lock',
      unlockSubmission: '/faculty-submission/:uuid/unlock',
      updateItem: '/submission-workflow/item/:itemId',
      claimItem: '/submission-workflow/item/:itemId/claim',
      unclaimItem: '/submission-workflow/item/:itemId/unclaim',
      assignItem: '/submission-workflow/item/:itemId/assign',
      updateItemStatus: '/submission-workflow/item/:itemId/status',
      addStaffCommunication: '/submission-workflow/item/:itemId/staff-message',
      getStaffCommunications: '/submission-workflow/item/:itemId/staff-messages',
      getStaffUsers: '/user/staff',
      myClaimedItems: '/submission-workflow/my-claimed-items',
      // Communication endpoints
      getSubmissionCommunications: '/submission-workflow/submission/:submissionId/communications',
      createCommunication: '/submission-workflow/submission/:submissionId/communications',
      updateCommunication: '/submission-workflow/communications/:messageId',
      markAsRead: '/submission-workflow/communications/:messageId/read',
      searchStaff: '/submission-workflow/search-staff',
    },
    workflow: {
      // Template Management
      listTemplates: '/workflow-admin/templates',
      getTemplate: '/workflow-admin/template/:id',
      createTemplate: '/workflow-admin/templates',
      updateTemplate: '/workflow-admin/template/:id',
      deleteTemplate: '/workflow-admin/template/:id',
      duplicateTemplate: '/workflow-admin/template/:id/duplicate',
      
      // Step Management
      createStep: '/workflow-admin/template/:templateId/steps',
      updateStep: '/workflow-admin/step/:id',
      deleteStep: '/workflow-admin/step/:id',
      reorderSteps: '/workflow-admin/template/:templateId/steps/reorder',
      
      // Condition Management
      createCondition: '/workflow-admin/step/:stepId/conditions',
      updateCondition: '/workflow-admin/condition/:id',
      deleteCondition: '/workflow-admin/condition/:id',
      
      // Transition Management
      createTransition: '/workflow-admin/step/:stepId/transitions',
      updateTransition: '/workflow-admin/transition/:id',
      deleteTransition: '/workflow-admin/transition/:id',
      
      // Instance Management (Execution)
      listInstances: '/workflow-admin/instances',
      getInstance: '/workflow-admin/instance/:id',
      createInstance: '/workflow-admin/instances',
      startWorkflow: '/workflow-admin/instance/:id/start',
      completeStep: '/workflow-admin/instance/:id/complete-step',
      skipStep: '/workflow-admin/instance/:id/skip-step',
      cancelWorkflow: '/workflow-admin/instance/:id/cancel',
      holdWorkflow: '/workflow-admin/instance/:id/hold',
      resumeWorkflow: '/workflow-admin/instance/:id/resume',
    }
  },
  environment: import.meta.env.MODE || 'development',
  getAuthUrl: function() {
    const authEndpoint = this.environment === 'production' 
      ? this.endpoints.auth.productionLogin 
      : this.endpoints.auth.developmentLogin;
    
    return `${this.urls.auth}${authEndpoint}`;
  },
  getRefreshTokenUrl: function() {
    const refreshEndpoint = this.environment === 'production' 
      ? this.endpoints.auth.refreshToken 
      : this.endpoints.auth.developmentRefreshToken;
    
    return `${this.urls.auth}${refreshEndpoint}`;
  },
  getAuthToken: function() {
    const token = localStorage.getItem('authToken');
    return token ? `Bearer ${token}` : '';
  },
};
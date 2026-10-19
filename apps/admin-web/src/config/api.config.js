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
        localRefreshToken: '/refresh-token-local.php',
        login: '/admin/login',
        developmentLogin: '/authorize-dev.php',
        localLogin: '/authorize-local.php',
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
        linkCourseOffering: '/course/link-course-offering',
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
      inventory: '/search/search-inventory',
      reservesWithCourses: '/search/search-reserves-with-courses',
    },
    courseReserves: {
      hitchcockSearch: '/hitchcock/search-resources',
      materialTypes: {
        all: '/material-type/all',
        fields: '/material-type/fields',
      },
    },
    facultyProxy: {
      staffGrants: '/faculty-proxy/staff/grants',
      staffActivityLog: '/faculty-proxy/staff/activity-log',
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
      updateItemStatus: '/submission-workflow/item/:itemId',
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
    workflowLinking: {
      needsLinking: '/workflow/needs-linking',
      submissionCandidates: '/workflow/submission/:uuid/candidates',
      submissionLink: '/workflow/submission/:uuid/link',
      submissionCorrect: '/workflow/submission/:uuid/correct',
      submissionLinkOverride: '/workflow/submission/:uuid/link-override',
      submissionUnlink: '/workflow/submission/:uuid/unlink',
      submissionRecheck: '/workflow/submission/:uuid/recheck',
      submissionTimeline: '/workflow/submission/:uuid/timeline',
    },
    workflowClaims: {
      queue: '/workflow/queue',
      myItems: '/workflow/my-items',
      staff: '/workflow/staff',
      itemTimeline: '/workflow/item/:kind/:id/timeline',
      itemClaim: '/workflow/item/:kind/:id/claim',
      itemRelease: '/workflow/item/:kind/:id/release',
      itemHandoff: '/workflow/item/:kind/:id/handoff',
      itemTakeover: '/workflow/item/:kind/:id/takeover',
      submissionClaimAll: '/workflow/submission/:uuid/claim-all',
    },
    workflow: {
      // Template Management
      listTemplates: '/workflow-admin/templates',
      getTemplate: '/workflow-admin/template/:id',
      createTemplate: '/workflow-admin/templates',
      updateTemplate: '/workflow-admin/template/:id',
      deleteTemplate: '/workflow-admin/template/:id',
      archiveTemplate: '/workflow-admin/template/:id/archive',
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
      goBack: '/workflow-admin/instance/:id/go-back',
      cancelWorkflow: '/workflow-admin/instance/:id/cancel',
      holdWorkflow: '/workflow-admin/instance/:id/hold',
      resumeWorkflow: '/workflow-admin/instance/:id/resume',
      transitionStep: '/workflow-admin/instance/:id/transition/:stepId',
      runAutomation: '/workflow-admin/instance/:id/run-automation/:stepId',
      runStepAutomation: '/workflow-admin/instance/:id/steps/:stepId/run-automation',
      completeStepById: '/workflow-admin/instance/:id/steps/:stepId/complete',
      getInstanceSteps: '/workflow-admin/instance/:id/steps',
    },
    checklist: {
      // Template Management
      listTemplates: '/checklist/list-templates',
      getTemplate: '/checklist/get-template/:id',
      createTemplate: '/checklist/create-template',
      updateTemplate: '/checklist/update-template/:id',
      deleteTemplate: '/checklist/delete-template/:id',
      duplicateTemplate: '/checklist/duplicate-template/:id',
      
      // Item Checklist Management
      getItemChecklist: '/checklist/get-item-checklist/:itemId',
      assignChecklist: '/checklist/assign-checklist/:itemId',
      updateTask: '/checklist/update-task/:itemId/:taskId',
      completeChecklist: '/checklist/complete-checklist/:itemId',
    }
  },
  environment: import.meta.env.MODE || 'development',
  isLocalDocker: import.meta.env.VITE_AUTH_LOCAL === 'true',
  getAuthUrl: function() {
    if (this.isLocalDocker) {
      return `${this.urls.auth}${this.endpoints.auth.localLogin}`;
    }
    const authEndpoint = this.environment === 'production' 
      ? this.endpoints.auth.productionLogin 
      : this.endpoints.auth.developmentLogin;
    
    return `${this.urls.auth}${authEndpoint}`;
  },
  getRefreshTokenUrl: function() {
    if (this.isLocalDocker) {
      return `${this.urls.auth}${this.endpoints.auth.localRefreshToken}`;
    }
    const refreshEndpoint = this.environment === 'production' 
      ? this.endpoints.auth.refreshToken 
      : this.endpoints.auth.developmentRefreshToken;
    
    return `${this.urls.auth}${refreshEndpoint}`;
  },
  getAuthToken: function() {
    const match = document.cookie.match(/(^| )accessToken=([^;]+)/);
    const token = match ? decodeURIComponent(match[2]) : null;
    return token ? `Bearer ${token}` : '';
  },
};

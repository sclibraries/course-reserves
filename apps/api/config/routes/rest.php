<?php

// Generic Yii REST routes follow the explicit route files.
return [
    'GET tracking/top-courses' => 'tracking/top-courses',
    'OPTIONS tracking/top-courses' => 'tracking/options',
    'GET tracking/analytics' => 'tracking/analytics',
    'OPTIONS tracking/analytics' => 'tracking/options',
    'GET tracking/course-detail' => 'tracking/course-detail',
    'OPTIONS tracking/course-detail' => 'tracking/options',
    'GET material-type/all' => 'material-type/all',
    'OPTIONS material-type/all' => 'material-type/options',
    'GET material-type/fields' => 'material-type/fields',
    'OPTIONS material-type/fields' => 'material-type/options',
    'GET physical-resource/by-external-id/<external_id>' => 'physical-resource/get-by-external-id',
    'OPTIONS physical-resource/update-resource-order' => 'cors-preflight/options',
    [
        'class' => 'yii\rest\UrlRule',
        'controller' => [
            'course',
            'resource',
            'material-type',
            'instructor',
            'folder',
            'tracking',
            'offering-link',
            'college-customization',
            'registration',
            'user',
            'permission',
            'physical-resource', // Add physical-resource controller
            'faculty-submission', // Add faculty-submission controller
            'submission-workflow', // Add submission-workflow controller
            'faculty-proxy', // Add faculty-proxy controller
        ],
        'pluralize' => false,
        'extraPatterns' => [
            'GET course-reserves/public/courses/<uuid>' => 'course/public-view',
            'POST offering-link' => 'offering-link/create',
            'OPTIONS offering-link' => 'options',
            'DELETE offering-link/<id>' => 'offering-link/delete',
            'OPTIONS offering-link/<id>' => 'options',
            'GET offering-link/find-links' => 'offering-link/find-links',
            'POST create-resource' => 'create-resource',
            'OPTIONS create-resource' => 'options',
            'GET search' => 'search', // Add custom search action
            'POST link-resource' => 'link-resource', // Add custom link-resource action
            'OPTIONS link-resource' => 'options',
            'GET exists' => 'exists',                             // => /course/exists
            'POST create-from-folio' => 'create-from-folio',      // => /course/create-from-folio
            'OPTIONS create-from-folio' => 'options',
            'GET <offeringId:\d+>/resources' => 'resources',        // => /course/123/resources
            'GET search-resources' => 'search-resources',
            'POST unlink-resource' => 'unlink-resource',
            'GET get-merged-resources' => 'get-merged-resources', // Add new endpoint
            'POST update-resource-order' => 'update-resource-order', // Add update-resource-order endpoint
            'GET pending' => 'pending',
            'OPTIONS pending' => 'options',
            'PUT approve/<id>' => 'approve',       // Maps to actionApprove
            'OPTIONS approve/<id>' => 'options',    // For CORS preflight
            'DELETE reject/<id>' => 'reject',          // Maps to actionReject
            'OPTIONS reject/<id>' => 'options',
            'GET current' => 'current',
            'OPTIONS current' => 'options',
            'GET me' => 'me',
            'POST register' => 'register',
            'GET grouped' => 'grouped',
            'GET available' => 'available',
            'PUT toggle/<id>' => 'toggle',
            'OPTIONS grouped' => 'options',
            'OPTIONS available' => 'options',
            'OPTIONS toggle/<id>' => 'options',
            'OPTIONS register' => 'options',
            'OPTIONS unlink-resource' => 'options',
            'OPTIONS update-resource-order' => 'options', // Add OPTIONS for update-resource-order
            'OPTIONS reactivate-course' => 'options',
            'OPTIONS check-course-exists' => 'options',
            'POST link-course-offering' => 'link-course-offering',
            'OPTIONS link-course-offering' => 'options',
            'OPTIONS me' => 'options',
            'GET' => 'index',
            'POST' => 'create',
            'OPTIONS' => 'options',

            // Physical Resource endpoints
            'POST physical-resource/create-or-update' => 'physical-resource/create-or-update-reference',
            'GET physical-resource/references/<offering_id:\d+>' => 'physical-resource/get-references',
            'POST physical-resource/update-order' => 'physical-resource/update-resource-order',
            'POST physical-resource/cleanup-references' => 'physical-resource/cleanup-references',

            // Add endpoint for course resource order updates
            'POST offering-link/update-resource-order' => 'offering-link/update-resource-order',
            'OPTIONS offering-link/update-resource-order' => 'options',
            // Faculty Submission endpoints
            'GET faculty-submission' => 'faculty-submission/index',
            'POST faculty-submission' => 'faculty-submission/create',
            'GET faculty-submission/view' => 'faculty-submission/view',
            'GET faculty-submission/status' => 'faculty-submission/status',
            'POST faculty-submission/submit-complete' => 'faculty-submission/submit-complete',
            'POST faculty-submission/mock-login' => 'faculty-submission/mock-login',
            'GET faculty-submission/course-history' => 'faculty-submission/course-history',
            'GET faculty-submission/material-types' => 'faculty-submission/material-types',
            // Numeric ID routes (legacy, but keep for backwards compatibility)
            'GET faculty-submission/<id:\d+>' => 'faculty-submission/view',
            'PUT faculty-submission/<id:\d+>' => 'faculty-submission/update',
            'POST faculty-submission/<id:\d+>/submit' => 'faculty-submission/submit',
            'POST faculty-submission/<id:\d+>/add-reuse-resource' => 'faculty-submission/add-reuse-resource',
            'POST faculty-submission/<id:\d+>/add-new-resource' => 'faculty-submission/add-new-resource',
            'POST faculty-submission/<id:\d+>/lock' => 'faculty-submission/lock',
            'POST faculty-submission/<id:\d+>/unlock' => 'faculty-submission/unlock',
            'OPTIONS faculty-submission' => 'options',
            'OPTIONS faculty-submission/view' => 'options',
            'OPTIONS faculty-submission/status' => 'options',
            'OPTIONS faculty-submission/submit-complete' => 'options',
            'OPTIONS faculty-submission/mock-login' => 'options',
            'OPTIONS faculty-submission/course-history' => 'options',
            'OPTIONS faculty-submission/material-types' => 'options',
            'OPTIONS faculty-submission/<id:\d+>' => 'options',
            'OPTIONS faculty-submission/<id:\d+>/submit' => 'options',
            'OPTIONS faculty-submission/<id:\d+>/add-reuse-resource' => 'options',
            'OPTIONS faculty-submission/<id:\d+>/add-new-resource' => 'options',

            // Faculty Proxy endpoints
            'GET my-proxies' => 'my-proxies',
            'GET my-faculty-access' => 'my-faculty-access',
            'POST invite-proxy' => 'invite-proxy',
            'DELETE revoke-proxy/<id:\d+>' => 'revoke-proxy',
            'POST accept-invitation' => 'accept-invitation',
            'GET validate-token/<token:[a-f0-9]{64}>' => 'validate-token',
            'GET can-act-as-proxy/<facultyId>/<courseId>' => 'can-act-as-proxy',
            'GET activity-log' => 'activity-log',
            'GET activity-log/<facultyId>' => 'activity-log',
            'GET staff/grants' => 'staff-grants',
            'GET staff/activity-log' => 'staff-activity-log',
            'DELETE staff/grants/<id:\d+>' => 'staff-revoke-grant',
            'OPTIONS my-proxies' => 'options',
            'OPTIONS my-faculty-access' => 'options',
            'OPTIONS invite-proxy' => 'options',
            'OPTIONS revoke-proxy/<id:\d+>' => 'options',
            'OPTIONS accept-invitation' => 'options',
            'OPTIONS validate-token/<token:[a-f0-9]{64}>' => 'options',
            'OPTIONS can-act-as-proxy/<facultyId>/<courseId>' => 'options',
            'OPTIONS activity-log' => 'options',
            'OPTIONS activity-log/<facultyId>' => 'options',
            'OPTIONS staff/grants' => 'options',
            'OPTIONS staff/activity-log' => 'options',
            'OPTIONS staff/grants/<id:\d+>' => 'options',
        ],
    ],
    // Explicit route files precede REST; this verb-only fallback cannot match business requests.
    'OPTIONS <path:.*>' => 'cors-preflight/options',
];

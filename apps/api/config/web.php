<?php

$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';

$config = [
    'id' => 'basic',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm'   => '@vendor/npm-asset',
    ],
    'components' => [
        'request' => [
            // !!! insert a secret key in the following (if it is empty) - this is required by cookie validation
            'cookieValidationKey' => getenv('COOKIE_VALIDATION_KEY') ?: '',
            'parsers' => [
                'application/json' => 'yii\web\JsonParser', // Enable JSON parsing
            ],
        ],
        // Global CORS - runs for all controllers; specific controllers can override
        'cors' => [
            'class' => \yii\filters\Cors::class,
            'cors' => [
                'Origin' => [
                    'https://libtools2.smith.edu',
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://localhost:8080',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173',
                    'http://127.0.0.1:5174',
                    'http://127.0.0.1:8080',
                ],
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ],
        'cache' => [
            'class' => 'yii\caching\FileCache',
        ],
        'user' => [
            'identityClass' => 'app\models\JwtIdentity',
            'enableAutoLogin' => false,
        ],
        'errorHandler' => [
            'errorAction' => 'site/error',
        ],
        'mailer' => [
            'class' => 'yii\swiftmailer\Mailer',
            // send all mails to a file by default. You have to set
            // 'useFileTransport' to false and configure transport
            // for the mailer to send real emails.
            'useFileTransport' => false,
        ],
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => [
                [
                    'class' => 'yii\log\FileTarget',
                    'levels' => ['error', 'warning', 'info'],
                ],
            ],
        ],
        'db' => $db,
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'rules' => [
                // Dev-only auth endpoint — blocked in production by the controller itself
                'POST dev-auth/login' => 'dev-auth/login',
                'OPTIONS dev-auth/login' => 'dev-auth/login',
                'GET sandbox-folio/search-courses' => 'sandbox-folio/search-courses',
                'OPTIONS sandbox-folio/search-courses' => 'sandbox-folio/options',

                // UUID-based faculty submission routes - MUST be before UrlRule
                'GET faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>' => 'faculty-submission/view',
                'PUT faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>' => 'faculty-submission/update',
                'POST faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/submit' => 'faculty-submission/submit',
                'POST faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/lock' => 'faculty-submission/lock',
                'POST faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/unlock' => 'faculty-submission/unlock',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>' => 'faculty-submission/options',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/submit' => 'faculty-submission/options',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/lock' => 'faculty-submission/options',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/unlock' => 'faculty-submission/options',
                
                // Communications endpoints - must be BEFORE rest UrlRule
                // Use UUID pattern to avoid conflicts
                'GET faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications' => 'faculty-submission/communications',
                'POST faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications' => 'faculty-submission/create-communication',
                'PUT faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications/<messageId:\d+>' => 'faculty-submission/update-communication',
                'DELETE faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications/<messageId:\d+>' => 'faculty-submission/delete-communication',
                'POST faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications/<messageId:\d+>/read' => 'faculty-submission/mark-communication-read',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications' => 'faculty-submission/options',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications/<messageId:\d+>' => 'faculty-submission/options',
                'OPTIONS faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications/<messageId:\d+>/read' => 'faculty-submission/options',
                
                // Staff Workflow endpoints - MUST be before UrlRule
                'GET submission-workflow/pending-submissions' => 'submission-workflow/pending-submissions',
                'GET submission-workflow/my-assignments' => 'submission-workflow/my-assignments',
                'GET submission-workflow/my-claimed-items' => 'submission-workflow/my-claimed-items',
                'GET submission-workflow/search-staff' => 'submission-workflow/search-staff',
                'GET submission-workflow/my-unread-count' => 'submission-workflow/my-unread-count',
                'GET submission-workflow/my-mentions' => 'submission-workflow/my-mentions',
                'POST submission-workflow/assign-submission' => 'submission-workflow/assign-submission',
                'PUT submission-workflow/assignment/<id:\d+>' => 'submission-workflow/update-assignment',
                'GET submission-workflow/submission/<id:\d+>' => 'submission-workflow/view-submission',
                'GET submission-workflow/submission/<id:\d+>/communications' => 'submission-workflow/communications',
                'POST submission-workflow/submission/<id:\d+>/communications' => 'submission-workflow/create-communication',
                'PUT submission-workflow/communications/<messageId:\d+>' => 'submission-workflow/update-communication',
                'POST submission-workflow/communications/<messageId:\d+>/read' => 'submission-workflow/mark-communication-read',
                'POST submission-workflow/complete/<id:\d+>' => 'submission-workflow/complete-submission',
                'PUT submission-workflow/item/<itemId:\d+>' => 'submission-workflow/update-item',
                'POST submission-workflow/item/<itemId:\d+>/complete-processing' => 'submission-workflow/complete-processing',
                'POST submission-workflow/item/<itemId:\d+>/claim' => 'submission-workflow/claim-item',
                'OPTIONS submission-workflow/pending-submissions' => 'submission-workflow/options',
                'OPTIONS submission-workflow/my-assignments' => 'submission-workflow/options',
                'OPTIONS submission-workflow/my-claimed-items' => 'submission-workflow/options',
                'OPTIONS submission-workflow/search-staff' => 'submission-workflow/options',
                'OPTIONS submission-workflow/my-unread-count' => 'submission-workflow/options',
                'OPTIONS submission-workflow/my-mentions' => 'submission-workflow/options',
                'OPTIONS submission-workflow/assign-submission' => 'submission-workflow/options',
                'OPTIONS submission-workflow/assignment/<id:\d+>' => 'submission-workflow/options',
                'OPTIONS submission-workflow/submission/<id:\d+>' => 'submission-workflow/options',
                'OPTIONS submission-workflow/submission/<id:\d+>/communications' => 'submission-workflow/options',
                'OPTIONS submission-workflow/submission/<id:[^/]+>/communications' => 'submission-workflow/options', // Catch undefined/invalid IDs
                'OPTIONS submission-workflow/communications/<messageId:\d+>' => 'submission-workflow/options',
                'OPTIONS submission-workflow/communications/<messageId:\d+>/read' => 'submission-workflow/options',
                'OPTIONS submission-workflow/complete/<id:\d+>' => 'submission-workflow/options',
                'OPTIONS submission-workflow/item/<itemId:\d+>' => 'submission-workflow/options',
                'OPTIONS submission-workflow/item/<itemId:\d+>/complete-processing' => 'submission-workflow/options',
                'OPTIONS submission-workflow/item/<itemId:\d+>/claim' => 'submission-workflow/options',
                
                // Workflow Admin endpoints - MUST be before UrlRule
                // S08 Decision (Option A): legacy-source/server/workflow-admin/{instances,steps,templates}.php
                // were NOT copied in S00 and are treated as dead code. All workflow CRUD (templates, steps,
                // conditions, transitions, instances) is fully covered by WorkflowAdminController below.
                // The orphaned files were also non-functional (missing ../includes/db.php and auth.php)
                // and used wildcard CORS (Access-Control-Allow-Origin: *) which is a security risk.
                'OPTIONS workflow-admin' => 'workflow-admin/options',
                'OPTIONS workflow-admin/<action>' => 'workflow-admin/options',
                'GET workflow-admin/templates' => 'workflow-admin/list-templates',
                'GET workflow-admin/template/<id:\d+>' => 'workflow-admin/get-template',
                'POST workflow-admin/templates' => 'workflow-admin/create-template',
                'PUT workflow-admin/template/<id:\d+>' => 'workflow-admin/update-template',
                'DELETE workflow-admin/template/<id:\d+>' => 'workflow-admin/delete-template',
                'POST workflow-admin/template/<id:\d+>/duplicate' => 'workflow-admin/duplicate-template',
                
                'POST workflow-admin/template/<templateId:\d+>/steps' => 'workflow-admin/create-step',
                'PUT workflow-admin/step/<id:\d+>' => 'workflow-admin/update-step',
                'DELETE workflow-admin/step/<id:\d+>' => 'workflow-admin/delete-step',
                'PUT workflow-admin/template/<templateId:\d+>/steps/reorder' => 'workflow-admin/reorder-steps',
                
                'POST workflow-admin/step/<stepId:\d+>/conditions' => 'workflow-admin/create-condition',
                'PUT workflow-admin/condition/<id:\d+>' => 'workflow-admin/update-condition',
                'DELETE workflow-admin/condition/<id:\d+>' => 'workflow-admin/delete-condition',
                
                'POST workflow-admin/transitions' => 'workflow-admin/create-transition',
                'PUT workflow-admin/transition/<id:\d+>' => 'workflow-admin/update-transition',
                'DELETE workflow-admin/transition/<id:\d+>' => 'workflow-admin/delete-transition',
                
                'GET workflow-admin/instances' => 'workflow-admin/list-instances',
                'GET workflow-admin/instance/<id:\d+>' => 'workflow-admin/get-instance',
                'POST workflow-admin/instances' => 'workflow-admin/create-instance',
                'POST workflow-admin/instance/<id:\d+>/start' => 'workflow-admin/start-instance',
                'POST workflow-admin/instance/<id:\d+>/complete-step' => 'workflow-admin/complete-step',
                'PATCH workflow-admin/instance/<id:\d+>/steps/<stepId:\d+>/transition' => 'workflow-admin/transition-step',
                'POST workflow-admin/instance/<id:\d+>/skip-step' => 'workflow-admin/skip-step',
                'POST workflow-admin/instance/<id:\d+>/go-back' => 'workflow-admin/go-back',
                'POST workflow-admin/instance/<id:\d+>/cancel' => 'workflow-admin/cancel-instance',
                'POST workflow-admin/instance/<id:\d+>/hold' => 'workflow-admin/hold-instance',
                'POST workflow-admin/instance/<id:\d+>/resume' => 'workflow-admin/resume-instance',
                'POST workflow-admin/template/<id:\d+>/archive' => 'workflow-admin/archive-template',
                
                // OPTIONS for workflow admin
                'OPTIONS workflow-admin/templates' => 'workflow-admin/options',
                'OPTIONS workflow-admin/template/<id:\d+>' => 'workflow-admin/options',
                'OPTIONS workflow-admin/template/<id:\d+>/archive' => 'workflow-admin/options',
                'OPTIONS workflow-admin/template/<id:\d+>/duplicate' => 'workflow-admin/options',
                'OPTIONS workflow-admin/template/<templateId:\d+>/steps' => 'workflow-admin/options',
                'OPTIONS workflow-admin/template/<templateId:\d+>/steps/reorder' => 'workflow-admin/options',
                'OPTIONS workflow-admin/step/<id:\d+>' => 'workflow-admin/options',
                'OPTIONS workflow-admin/step/<stepId:\d+>/conditions' => 'workflow-admin/options',
                'OPTIONS workflow-admin/condition/<id:\d+>' => 'workflow-admin/options',
                'OPTIONS workflow-admin/transitions' => 'workflow-admin/options',
                'OPTIONS workflow-admin/transition/<id:\d+>' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instances' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/start' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/complete-step' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/steps/<stepId:\d+>/transition' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/skip-step' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/go-back' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/cancel' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/hold' => 'workflow-admin/options',
                'OPTIONS workflow-admin/instance/<id:\d+>/resume' => 'workflow-admin/options',
                
                // Checklist endpoints
                'GET checklist/list-templates' => 'checklist/list-templates',
                'GET checklist/get-template/<id:\d+>' => 'checklist/get-template',
                'GET checklist/get-template' => 'checklist/get-template',
                'POST checklist/create-template' => 'checklist/create-template',
                'PUT checklist/update-template/<id:\d+>' => 'checklist/update-template',
                'PUT checklist/update-template' => 'checklist/update-template',
                'DELETE checklist/delete-template/<id:\d+>' => 'checklist/delete-template',
                'DELETE checklist/delete-template' => 'checklist/delete-template',
                'POST checklist/duplicate-template/<id:\d+>' => 'checklist/duplicate-template',
                'POST checklist/duplicate-template' => 'checklist/duplicate-template',
                
                'GET checklist/get-item-checklist/<itemId:\d+>' => 'checklist/get-item-checklist',
                'GET checklist/get-item-checklist' => 'checklist/get-item-checklist',
                'POST checklist/assign-checklist/<itemId:\d+>' => 'checklist/assign-checklist',
                'POST checklist/assign-checklist' => 'checklist/assign-checklist',
                'PATCH checklist/update-task' => 'checklist/update-task',
                'POST checklist/complete-checklist/<itemId:\d+>' => 'checklist/complete-checklist',
                'POST checklist/complete-checklist' => 'checklist/complete-checklist',
                
                'OPTIONS checklist/list-templates' => 'checklist/options',
                'OPTIONS checklist/get-template' => 'checklist/options',
                'OPTIONS checklist/get-template/<id:\d+>' => 'checklist/options',
                'OPTIONS checklist/create-template' => 'checklist/options',
                'OPTIONS checklist/update-template' => 'checklist/options',
                'OPTIONS checklist/update-template/<id:\d+>' => 'checklist/options',
                'OPTIONS checklist/delete-template' => 'checklist/options',
                'OPTIONS checklist/delete-template/<id:\d+>' => 'checklist/options',
                'OPTIONS checklist/duplicate-template' => 'checklist/options',
                'OPTIONS checklist/duplicate-template/<id:\d+>' => 'checklist/options',
                'OPTIONS checklist/get-item-checklist' => 'checklist/options',
                'OPTIONS checklist/get-item-checklist/<itemId:\d+>' => 'checklist/options',
                'OPTIONS checklist/assign-checklist' => 'checklist/options',
                'OPTIONS checklist/assign-checklist/<itemId:\d+>' => 'checklist/options',
                'OPTIONS checklist/update-task' => 'checklist/options',
                'OPTIONS checklist/complete-checklist' => 'checklist/options',
                'OPTIONS checklist/complete-checklist/<itemId:\d+>' => 'checklist/options',
                
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
                        'GET physical-resource/by-external-id/<external_id>' => 'physical-resource/get-by-external-id',
                        'POST physical-resource/cleanup-references' => 'physical-resource/cleanup-references',
                        'OPTIONS physical-resource/by-external-id/<external_id>' => 'options',
                        'OPTIONS physical-resource/create-or-update' => 'options',
                        'OPTIONS physical-resource/references/<offering_id:\d+>' => 'options',
                        'OPTIONS physical-resource/update-order' => 'options',
                        'OPTIONS physical-resource/cleanup-references' => 'options',

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
                        'GET faculty-proxy/my-proxies' => 'faculty-proxy/my-proxies',
                        'GET faculty-proxy/my-faculty-access' => 'faculty-proxy/my-faculty-access',
                        'POST faculty-proxy/invite-proxy' => 'faculty-proxy/invite-proxy',
                        'DELETE faculty-proxy/revoke-proxy/<id:\d+>' => 'faculty-proxy/revoke-proxy',
                        'POST faculty-proxy/accept-invitation' => 'faculty-proxy/accept-invitation',
                        'GET faculty-proxy/validate-token/<token>' => 'faculty-proxy/validate-token',
                        'GET faculty-proxy/can-act-as-proxy/<facultyId>/<courseId>' => 'faculty-proxy/can-act-as-proxy',
                        'GET faculty-proxy/activity-log' => 'faculty-proxy/activity-log',
                        'GET faculty-proxy/activity-log/<facultyId>' => 'faculty-proxy/activity-log',
                        'OPTIONS faculty-proxy/my-proxies' => 'options',
                        'OPTIONS faculty-proxy/my-faculty-access' => 'options',
                        'OPTIONS faculty-proxy/invite-proxy' => 'options',
                        'OPTIONS faculty-proxy/revoke-proxy/<id:\d+>' => 'options',
                        'OPTIONS faculty-proxy/accept-invitation' => 'options',
                        'OPTIONS faculty-proxy/validate-token/<token>' => 'options',
                        'OPTIONS faculty-proxy/can-act-as-proxy/<facultyId>/<courseId>' => 'options',
                        'OPTIONS faculty-proxy/activity-log' => 'options',
                        'OPTIONS faculty-proxy/activity-log/<facultyId>' => 'options',
                    ],
                ],
            ],
        ],
    ],
    'params' => $params,
];

if (YII_ENV_DEV) {
    // configuration adjustments for 'dev' environment
    $config['bootstrap'][] = 'debug';
    $config['modules']['debug'] = [
        'class' => 'yii\debug\Module',
        // uncomment the following to add your IP if you are not connecting from localhost.
        'allowedIPs' => ['127.0.0.1', '::1'],
    ];

    $config['bootstrap'][] = 'gii';
    $config['modules']['gii'] = [
        'class' => 'yii\gii\Module',
        // uncomment the following to add your IP if you are not connecting from localhost.
        'allowedIPs' => ['127.0.0.1', '::1'],
    ];
}

return $config;

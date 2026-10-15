<?php

// Workflow administration routes must precede the generic REST rule.
return [
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
];

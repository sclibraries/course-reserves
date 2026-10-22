<?php

// UUID and communications routes must precede the generic REST rule.
return [
    'POST faculty-submission/draft' => 'faculty-draft/create',
    'OPTIONS faculty-submission/draft' => 'faculty-draft/options',
    'DELETE faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>' => 'faculty-draft/delete',
    'GET faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi' => 'syllabus/faculty-list',
    'POST faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi' => 'syllabus/faculty-create',
    'GET faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi/<sid:\d+>/file' => 'syllabus/faculty-file',
    'OPTIONS faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi' => 'syllabus/options',
    'OPTIONS faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi/<sid:\d+>/file' => 'syllabus/options',
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
];

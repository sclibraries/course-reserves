<?php

// Checklist routes must precede the generic REST rule.
return [
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
];

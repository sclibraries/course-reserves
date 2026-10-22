<?php

$listFromEnvironment = static function ($name) {
    return array_values(array_filter(array_map('trim', explode(',', getenv($name) ?: ''))));
};

return [
    'workflowClaimExpiryHours' => 72,
    'corsOrigins' => $listFromEnvironment('CORS_ALLOWED_ORIGINS'),
    'facultyFormUrl' => getenv('FACULTY_FORM_URL') ?: null,
    'googleDocBaseUrl' => rtrim(getenv('GOOGLE_DOC_BASE_URL') ?: 'https://docs.google.com', '/'),
    'syllabus' => [
        'storagePath' => getenv('SYLLABUS_STORAGE_PATH') ?: '@runtime/syllabi',
        'maxUploadBytes' => (int)(getenv('SYLLABUS_MAX_UPLOAD_BYTES') ?: 10485760),
    ],
    'folio' => [
        'searchBaseUrl' => getenv('FOLIO_SEARCH_BASE_URL') ?: 'https://libtools2.smith.edu/folio/web/search',
        'timeoutSeconds' => (int)(getenv('FOLIO_TIMEOUT_SECONDS') ?: 5),
    ],
    'linkSuggestions' => [
        'staleMinutes' => (int)(getenv('LINK_SUGGESTION_STALE_MINUTES') ?: 10),
        'refreshLimit' => (int)(getenv('LINK_SUGGESTION_REFRESH_LIMIT') ?: 10),
        'pageSize' => (int)(getenv('LINK_SUGGESTION_PAGE_SIZE') ?: 20),
    ],
    'ebsco' => [
        'endPoint' => 'https://eds-api.ebscohost.com/edsapi/rest',
        'authEndPoint' => 'https://eds-api.ebscohost.com/Authservice/rest',
        'abstractLength' => 300,
        'userId' => getenv('EBSCO_USER_ID'),
        'password' => getenv('EBSCO_PASSWORD'),
        'edsProfile' => getenv('EBSCO_PROFILE') ?: '',
        'ipAddresses' => $listFromEnvironment('EBSCO_IP_PREFIXES'),
    ],
    'hitchcock' => [
        'username' => getenv('HITCHCOCK_USERNAME'),
        'password' => getenv('HITCHCOCK_PASSWORD'),
    ],
    'adminEmails' => $listFromEnvironment('ADMIN_EMAILS'),
];

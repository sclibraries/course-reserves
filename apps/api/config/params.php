<?php

$listFromEnvironment = static function ($name) {
    return array_values(array_filter(array_map('trim', explode(',', getenv($name) ?: ''))));
};

return [
    'corsOrigins' => $listFromEnvironment('CORS_ALLOWED_ORIGINS'),
    'folio' => [
        'searchBaseUrl' => getenv('FOLIO_SEARCH_BASE_URL') ?: 'https://libtools2.smith.edu/folio/web/search',
        'timeoutSeconds' => (int)(getenv('FOLIO_TIMEOUT_SECONDS') ?: 5),
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

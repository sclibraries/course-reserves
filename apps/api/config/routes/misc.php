<?php

// Miscellaneous and sandbox endpoints.
return [
    // Dev-only auth endpoint — blocked in production by the controller itself
    'POST dev-auth/login' => 'dev-auth/login',
    'OPTIONS dev-auth/login' => 'dev-auth/login',
    'GET sandbox-folio/search-courses' => 'sandbox-folio/search-courses',
    'OPTIONS sandbox-folio/search-courses' => 'sandbox-folio/options',
];

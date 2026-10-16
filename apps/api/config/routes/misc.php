<?php

// Miscellaneous endpoints.
return [
    // Dev-only auth endpoint — blocked in production by the controller itself
    'POST dev-auth/login' => 'dev-auth/login',
    'OPTIONS dev-auth/login' => 'dev-auth/login',
];

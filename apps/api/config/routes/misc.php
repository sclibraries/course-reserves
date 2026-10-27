<?php

// Miscellaneous endpoints.
return [
    // Dev-only auth endpoint — blocked in production by the controller itself
    'POST dev-auth/login' => 'dev-auth/login',
    'OPTIONS dev-auth/login' => 'dev-auth/login',
    'GET catalog-availability' => 'catalog-availability/index',
    'OPTIONS catalog-availability' => 'catalog-availability/options',
    'GET staff-nav-pins' => 'staff-nav-pin/index',
    'PUT staff-nav-pins' => 'staff-nav-pin/index',
    'DELETE staff-nav-pins' => 'staff-nav-pin/index',
    'OPTIONS staff-nav-pins' => 'staff-nav-pin/options',
    'GET staff-nav-pins/defaults' => 'staff-nav-pin/defaults',
    'PUT staff-nav-pins/defaults' => 'staff-nav-pin/defaults',
    'OPTIONS staff-nav-pins/defaults' => 'staff-nav-pin/options',
];

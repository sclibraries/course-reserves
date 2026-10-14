<?php

namespace app\components;

/**
 * Shared role groups for API access policies.
 */
class Roles
{
    const STAFF = ['staff', 'admin'];
    const SIGNED_IN = ['faculty', 'staff', 'admin'];
}

<?php

namespace app\components;

/**
 * Shared role groups for API access policies.
 */
class Roles
{
    const STAFF = ['staff', 'admin'];
    const SIGNED_IN = ['faculty', 'staff', 'admin', 'employee'];

    /**
     * Check whether a role is staff or admin.
     *
     * @param mixed $role Role claim to check.
     * @return bool
     */
    public static function isStaff($role)
    {
        return in_array($role, self::STAFF, true);
    }
}

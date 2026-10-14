<?php

namespace app\services;

use app\components\Roles;

/**
 * Resolves roles for the Shibboleth faculty sign-in and refresh paths.
 */
class FacultyRoleResolver
{
    private $users;

    public function __construct(ApprovedUserLookup $users = null)
    {
        $this->users = $users ?: new ApprovedUserLookup();
    }

    /**
     * Resolve a faculty-form role from the approved library user record and affiliation.
     *
     * @param string $username
     * @param string $affiliation
     * @return string
     */
    public function forFacultyAuthorization($username, $affiliation)
    {
        $user = $this->users->find($username);
        if ($this->isApprovedStaff($user)) {
            return $user['role'];
        }

        if (stripos((string)$affiliation, 'faculty') !== false) {
            return 'faculty';
        }

        return 'employee';
    }

    /**
     * Revalidate privileged refresh roles against the approved users table.
     *
     * @param string $username
     * @param string|null $claimedRole
     * @return string
     */
    public function forRefresh($username, $claimedRole)
    {
        $user = $this->users->find($username);
        if ($this->isApprovedStaff($user)) {
            return $user['role'];
        }

        return $claimedRole === 'faculty' ? 'faculty' : 'employee';
    }

    private function isApprovedStaff($user)
    {
        return is_array($user)
            && isset($user['approved'])
            && (int)$user['approved'] === 1
            && Roles::isStaff($user['role'] ?? null);
    }
}

<?php

namespace app\services;

use app\components\Roles;

/**
 * Builds the canonical JWT identity claims shared by faculty token issuers.
 */
class FacultyTokenClaims
{
    /**
     * Add canonical identity and time claims to an authorization payload.
     *
     * @param  array       $identityClaims Stable identity fields for the token.
     * @param  string|null $internalId     Faculty internal identifier.
     * @param  int         $issuedAt       Token issue time.
     * @param  int         $expiration     Token expiration time.
     * @return array
     */
    public static function forAuthorization(
        array $identityClaims,
        $internalId,
        $issuedAt,
        $expiration
    ) {
        unset($identityClaims['interal_id']);
        $identityClaims['internal_id'] = $internalId;
        $identityClaims['iat'] = $issuedAt;
        $identityClaims['exp'] = $expiration;

        return $identityClaims;
    }

    /**
     * Normalize legacy claims and set new time claims during token refresh.
     *
     * @param  array $decodedClaims Claims from the validated refresh token.
     * @param  int   $issuedAt      Token issue time.
     * @param  int   $expiration    Token expiration time.
     * @param  string|null $verifiedRole Role revalidated against the users table.
     * @return array
     */
    public static function forRefresh(array $decodedClaims, $issuedAt, $expiration, $verifiedRole = null)
    {
        $internalId = $decodedClaims['internal_id']
            ?? $decodedClaims['interal_id']
            ?? null;
        $role = $verifiedRole;
        if ($role === null) {
            $claimedRole = $decodedClaims['role'] ?? null;
            $role = Roles::isStaff($claimedRole) ? 'employee' : $claimedRole;
        }
        if (!in_array($role, Roles::SIGNED_IN, true)) {
            $role = 'employee';
        }

        return [
            'username' => $decodedClaims['username'],
            'role' => $role,
            'id' => $decodedClaims['id'] ?? $decodedClaims['username'],
            'full_name' => $decodedClaims['full_name'] ?? null,
            'email' => $decodedClaims['email'] ?? null,
            'institution' => $decodedClaims['institution'] ?? null,
            'internal_id' => $internalId,
            'iat' => $issuedAt,
            'exp' => $expiration,
        ];
    }
}

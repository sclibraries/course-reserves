<?php
/**
 * IdentityService.php
 *
 * Centralised Shibboleth identity attribute reader.
 *
 * In production the Apache mod_shib module injects attributes as server
 * variables.  In the local Docker environment (YII_ENV === 'dev') those
 * variables do not exist, so we fall back to the DEV_USERNAME env var or
 * the 'devadmin' seed account instead.
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */

namespace app\services;

class IdentityService
{
    /**
     * Return a normalised array of identity attributes regardless of
     * whether we are running under real Shibboleth or the local dev stub.
     *
     * @return array{username: string, email: string, full_name: string}
     */
    public function getIdentityAttributes()
    {
        if (YII_ENV === 'dev') {
            return $this->getDevAttributes();
        }

        return $this->getShibbolethAttributes();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Read attributes injected by Apache mod_shib in production.
     *
     * @return array
     */
    private function getShibbolethAttributes()
    {
        $username  = isset($_SERVER['REMOTE_USER'])  ? $_SERVER['REMOTE_USER']  : '';
        $email     = isset($_SERVER['mail'])          ? $_SERVER['mail']          : '';
        $fullName  = isset($_SERVER['displayName'])   ? $_SERVER['displayName']   : '';

        return [
            'username'  => $username,
            'email'     => $email,
            'full_name' => $fullName,
        ];
    }

    /**
     * Return a stub identity for local Docker development.
     * Mirrors the user lookup performed by authorize-local.php.
     *
     * @return array
     */
    private function getDevAttributes()
    {
        $devUsername = getenv('DEV_USERNAME') ?: 'devadmin';

        return [
            'username'  => $devUsername,
            'email'     => $devUsername . '@dev.local',
            'full_name' => 'Dev User (' . $devUsername . ')',
        ];
    }
}

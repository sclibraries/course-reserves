<?php

namespace app\services;

use Yii;

/**
 * Loads approved library user records for auth endpoints.
 */
class ApprovedUserLookup
{
    private $finder;

    /**
     * @param callable|null $finder Optional user lookup for unit tests.
     */
    public function __construct($finder = null)
    {
        $this->finder = $finder;
    }

    /**
     * Find the approved user row used by the admin and faculty auth paths.
     *
     * @param string $username
     * @return array|false
     */
    public function find($username)
    {
        if ($this->finder !== null) {
            return call_user_func($this->finder, $username);
        }

        try {
            return Yii::$app->db->createCommand(
                'SELECT id, username, full_name, email, role, department, institution, approved '
                . 'FROM users WHERE username = :username AND approved = 1'
            )->bindValue(':username', $username)
                ->queryOne();
        } catch (\Exception $e) {
            Yii::error('Database query failed: ' . $e->getMessage());
            return false;
        }
    }
}

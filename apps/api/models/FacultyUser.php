<?php

namespace app\models;

use Yii;
use yii\base\BaseObject;
use yii\web\IdentityInterface;

/**
 * Faculty User model for session-based authentication
 * This is NOT stored in the database - it's session-based only
 */
class FacultyUser extends BaseObject implements IdentityInterface
{
    public $id;
    public $shibboleth_user_id;
    public $display_name;
    public $email;
    public $department;
    public $institution;
    public $session_token;
    public $expires_at;
    public $shibboleth_attributes;

    /**
     * {@inheritdoc}
     */
    public static function findIdentity($id)
    {
        // Not used for faculty - they use session-based auth
        return null;
    }

    /**
     * {@inheritdoc}
     */
    public static function findIdentityByAccessToken($token, $type = null)
    {
        // Check if there's a valid faculty session with this token
        session_start();
        
        if (!isset($_SESSION['faculty_auth']) || $_SESSION['faculty_auth']['session_token'] !== $token) {
            return null;
        }

        $facultyAuth = $_SESSION['faculty_auth'];
        
        // Check if session has expired
        if (strtotime($facultyAuth['expires_at']) < time()) {
            unset($_SESSION['faculty_auth']);
            return null;
        }

        // Create faculty user object
        $user = new static();
        $user->id = $facultyAuth['user_id'];
        $user->shibboleth_user_id = $facultyAuth['user_id'];
        $user->display_name = $facultyAuth['display_name'];
        $user->email = $facultyAuth['email'];
        $user->department = $facultyAuth['department'];
        $user->institution = $facultyAuth['institution'];
        $user->session_token = $facultyAuth['session_token'];
        $user->expires_at = $facultyAuth['expires_at'];
        $user->shibboleth_attributes = $facultyAuth['shibboleth_attributes'];

        return $user;
    }

    /**
     * {@inheritdoc}
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * {@inheritdoc}
     */
    public function getAuthKey()
    {
        return $this->session_token;
    }

    /**
     * {@inheritdoc}
     */
    public function validateAuthKey($authKey)
    {
        return $this->session_token === $authKey;
    }

    /**
     * Get display name or fallback to user ID
     */
    public function getDisplayName()
    {
        return $this->display_name ?: $this->shibboleth_user_id;
    }

    /**
     * Check if user can proxy for another faculty member
     * This could be enhanced with more sophisticated logic
     */
    public function canProxyFor($targetUserId)
    {
        // For now, just allow if they're faculty/staff
        // You might want to implement actual proxy permissions
        return !empty($this->department);
    }

    /**
     * Get user's courses from FOLIO API
     * This is a placeholder - implement actual FOLIO integration
     */
    public function getCourses($termId = null)
    {
        // TODO: Implement actual FOLIO API call
        // This would use the faculty's name to search for courses
        
        return [
            [
                'folio_course_listing_id' => 'ABC123',
                'course_title' => 'Introduction to Psychology PSYC 101-01',
                'term_id' => 'spring2025',
                'term_name' => 'Spring 2025',
                'instructor_name' => $this->display_name,
                'has_existing_resources' => false
            ],
            [
                'folio_course_listing_id' => 'DEF456',
                'course_title' => 'Advanced Psychology PSYC 301-01',
                'term_id' => 'spring2025',
                'term_name' => 'Spring 2025',
                'instructor_name' => $this->display_name,
                'has_existing_resources' => true
            ]
        ];
    }

    /**
     * Get historical courses for import
     */
    public function getHistoricalCourses($limit = 10)
    {
        // TODO: Implement actual FOLIO API call for historical data
        
        return [
            [
                'folio_course_listing_id' => 'HIST789',
                'course_title' => 'Introduction to Psychology PSYC 101-01',
                'term_id' => 'fall2024',
                'term_name' => 'Fall 2024',
                'resource_count' => 15
            ]
        ];
    }
}
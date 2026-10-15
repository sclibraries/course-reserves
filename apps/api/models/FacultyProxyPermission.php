<?php

namespace app\models;

use yii\db\ActiveRecord;
use yii\db\Expression;
use yii\db\Query;
use yii\behaviors\TimestampBehavior;

/**
 * FacultyProxyPermission model
 *
 * @property int $permission_id
 * @property string $faculty_shibboleth_id
 * @property string $proxy_shibboleth_id
 * @property string $faculty_display_name
 * @property string $faculty_internal_id
 * @property string $proxy_display_name
 * @property string $proxy_email
 * @property string $permission_type
 * @property string $status
 * @property string $invited_at
 * @property string $invitation_expires_at
 * @property string $accepted_at
 * @property string $expires_at
 * @property string $revoked_at
 * @property string $invitation_token
 * @property string $notes
 * @property string $created_at
 * @property string $updated_at
 */
class FacultyProxyPermission extends ActiveRecord
{
    const PERMISSION_FULL_ACCESS = 'full_access';
    const PERMISSION_VIEW_ONLY = 'view_only';
    const PERMISSION_SPECIFIC_COURSES = 'specific_courses';
    
    const STATUS_PENDING = 'pending';
    const STATUS_ACTIVE = 'active';
    const STATUS_REVOKED = 'revoked';
    const STATUS_EXPIRED = 'expired';

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'faculty_proxy_permissions';
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            [
                'class' => TimestampBehavior::class,
                'createdAtAttribute' => 'created_at',
                'updatedAtAttribute' => 'updated_at',
                'value' => function() {
                    return date('Y-m-d H:i:s');
                }
            ]
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['faculty_shibboleth_id', 'proxy_shibboleth_id'], 'required'],
            [['notes'], 'string'],
            [['faculty_internal_id'], 'string', 'max' => 255],
            [['invited_at', 'invitation_expires_at', 'accepted_at', 'expires_at', 'revoked_at', 'created_at', 'updated_at'], 'safe'],
            [['faculty_shibboleth_id', 'proxy_shibboleth_id', 'faculty_display_name', 'proxy_display_name', 'proxy_email'], 'string', 'max' => 255],
            [['invitation_token'], 'string', 'max' => 64],
            [['permission_type'], 'in', 'range' => [self::PERMISSION_FULL_ACCESS, self::PERMISSION_VIEW_ONLY, self::PERMISSION_SPECIFIC_COURSES]],
            [['status'], 'in', 'range' => [self::STATUS_PENDING, self::STATUS_ACTIVE, self::STATUS_REVOKED, self::STATUS_EXPIRED]],
            [['permission_type'], 'default', 'value' => self::PERMISSION_FULL_ACCESS],
            [['status'], 'default', 'value' => self::STATUS_PENDING],
            [['proxy_email'], 'email'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'permission_id' => 'Permission ID',
            'faculty_shibboleth_id' => 'Faculty User ID',
            'proxy_shibboleth_id' => 'Proxy User ID',
            'faculty_display_name' => 'Faculty Name',
            'faculty_internal_id' => 'Faculty Internal ID',
            'proxy_display_name' => 'Proxy Name',
            'proxy_email' => 'Proxy Email',
            'permission_type' => 'Permission Type',
            'status' => 'Status',
            'invited_at' => 'Invited At',
            'accepted_at' => 'Accepted At',
            'expires_at' => 'Expires At',
            'revoked_at' => 'Revoked At',
            'invitation_token' => 'Invitation Token',
            'notes' => 'Notes',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getCoursePermissions()
    {
        return $this->hasMany(FacultyProxyCoursePermission::class, ['permission_id' => 'permission_id']);
    }

    /**
     * Generate invitation token before saving
     */
    public function beforeSave($insert)
    {
        if ($insert && empty($this->invitation_token)) {
            $this->invitation_token = $this->generateInvitationToken();
        }
        
        if ($insert) {
            $this->invited_at = date('Y-m-d H:i:s');
            $this->invitation_expires_at = date('Y-m-d H:i:s', strtotime($this->invited_at . ' +14 days'));
        }

        return parent::beforeSave($insert);
    }

    /**
     * Generate secure invitation token
     */
    private function generateInvitationToken()
    {
        return bin2hex(random_bytes(32));
    }

    /**
     * Accept invitation
     */
    public function acceptInvitation($proxyUserData)
    {
        $this->status = self::STATUS_ACTIVE;
        $this->accepted_at = date('Y-m-d H:i:s');
        
        // Update proxy info from Shibboleth data
        if (!empty($proxyUserData['display_name'])) {
            $this->proxy_display_name = $proxyUserData['display_name'];
        }
        if (!empty($proxyUserData['email'])) {
            $this->proxy_email = $proxyUserData['email'];
        }

        return $this->save();
    }

    /**
     * Revoke permission
     */
    public function revoke()
    {
        $this->status = self::STATUS_REVOKED;
        $this->revoked_at = date('Y-m-d H:i:s');
        return $this->save();
    }

    /**
     * Check if permission is currently active
     */
    public function isActive($updateExpiredStatus = true)
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }

        // Check expiration
        if ($this->expires_at && strtotime($this->expires_at) < time()) {
            if ($updateExpiredStatus) {
                $this->status = self::STATUS_EXPIRED;
                $this->save();
            }
            return false;
        }

        return true;
    }

    /**
     * Check if proxy can access specific course
     */
    public function canAccessCourse($folioCourseListingId, $updateExpiredStatus = true)
    {
        if (!$this->isActive($updateExpiredStatus)) {
            return false;
        }

        return self::find()
            ->alias('proxy_permission')
            ->where(['proxy_permission.permission_id' => $this->permission_id])
            ->andWhere(self::courseScopeCondition('proxy_permission', $folioCourseListingId))
            ->exists();
    }

    /**
     * SQL predicate shared by row authorization and accessible submission queries.
     */
    public static function courseScopeCondition($permissionAlias, $folioCourseListingId)
    {
        $courseScope = (new Query())
            ->select(new Expression('1'))
            ->from(['course_scope' => FacultyProxyCoursePermission::tableName()])
            ->where('course_scope.permission_id = ' . $permissionAlias . '.permission_id')
            ->andWhere(['=', 'course_scope.folio_course_listing_id', $folioCourseListingId]);

        return [
            'or',
            [$permissionAlias . '.permission_type' => [self::PERMISSION_FULL_ACCESS, self::PERMISSION_VIEW_ONLY]],
            [
                'and',
                [$permissionAlias . '.permission_type' => self::PERMISSION_SPECIFIC_COURSES],
                ['exists', $courseScope],
            ],
        ];
    }

    /**
     * Check if proxy can edit (not just view)
     */
    public function canEdit($updateExpiredStatus = true)
    {
        return $this->isActive($updateExpiredStatus) && $this->permission_type !== self::PERMISSION_VIEW_ONLY;
    }

    /**
     * Get status options
     */
    public static function getStatusOptions()
    {
        return [
            self::STATUS_PENDING => 'Pending',
            self::STATUS_ACTIVE => 'Active',
            self::STATUS_REVOKED => 'Revoked',
            self::STATUS_EXPIRED => 'Expired',
        ];
    }

    /**
     * Get permission type options
     */
    public static function getPermissionTypeOptions()
    {
        return [
            self::PERMISSION_FULL_ACCESS => 'Full Access',
            self::PERMISSION_VIEW_ONLY => 'View Only',
            self::PERMISSION_SPECIFIC_COURSES => 'Specific Courses',
        ];
    }

    /**
     * Log proxy activity
     */
    public function logActivity($action, $submissionId = null, $details = null)
    {
        $log = new FacultyProxyActivityLog();
        $log->faculty_shibboleth_id = $this->faculty_shibboleth_id;
        $log->proxy_shibboleth_id = $this->proxy_shibboleth_id;
        $log->action = $action;
        $log->submission_id = $submissionId;
        $log->details = $details ? json_encode($details) : null;
        return $log->save();
    }
}

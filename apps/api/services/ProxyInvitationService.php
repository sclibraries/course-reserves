<?php

namespace app\services;

use app\models\FacultyProxyCoursePermission;
use app\models\FacultyProxyPermission;
use Yii;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\GoneHttpException;
use yii\web\NotFoundHttpException;
use yii\web\ServerErrorHttpException;

/**
 * Creates and accepts faculty proxy invitations.
 */
class ProxyInvitationService
{
    private $presenter;
    private $courseRoster;

    public function __construct($courseRoster = null, $presenter = null)
    {
        $this->courseRoster = $courseRoster ?: new ProxyCourseRosterService();
        $this->presenter = $presenter ?: new FacultyProxyPresenter();
    }

    public function invite(array $actor, array $data)
    {
        if (($actor['role'] ?? null) !== 'faculty') {
            throw new ForbiddenHttpException('Only faculty may invite a proxy');
        }
        if (empty($data['proxy_email'])) {
            throw new BadRequestHttpException('proxy_email is required');
        }
        $this->facultyFormUrl();

        $email = trim($data['proxy_email']);
        $permissionType = $data['permission_type'] ?? FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES;
        if (!in_array($permissionType, [
                FacultyProxyPermission::PERMISSION_FULL_ACCESS,
                FacultyProxyPermission::PERMISSION_VIEW_ONLY,
                FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            ], true)) {
            throw new BadRequestHttpException('Invalid permission_type');
        }

        $existing = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $actor['user_id'],
                'proxy_email' => $email,
                'status' => [FacultyProxyPermission::STATUS_PENDING, FacultyProxyPermission::STATUS_ACTIVE],
            ])
            ->all();
        foreach ($existing as $grant) {
            if ($grant->status === FacultyProxyPermission::STATUS_ACTIVE ||
                (strtotime((string)$grant->invitation_expires_at) > time())
            ) {
                throw new ConflictHttpException('A current invitation or grant already exists for this email');
            }
            $grant->status = FacultyProxyPermission::STATUS_EXPIRED;
            $grant->save(false, ['status']);
        }

        $courseData = [];
        if ($permissionType === FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES) {
            $courseData = $this->courseRoster->validatedCourses($actor, $data['course_permissions'] ?? null);
        }

        $permission = new FacultyProxyPermission();
        $permission->faculty_shibboleth_id = $actor['user_id'];
        $permission->faculty_display_name = $actor['display_name'] ?? null;
        $permission->faculty_internal_id = $actor['internal_id'] ?? null;
        $permission->proxy_shibboleth_id = 'pending_' . bin2hex(random_bytes(16));
        $permission->proxy_email = $email;
        $permission->permission_type = $permissionType;
        $permission->expires_at = $data['expires_at'] ?? null;

        $transaction = Yii::$app->db->beginTransaction();
        try {
            if (!$permission->save()) {
                throw new BadRequestHttpException('Unable to save proxy invitation');
            }

            foreach ($courseData as $course) {
                $coursePermission = new FacultyProxyCoursePermission();
                $coursePermission->permission_id = $permission->permission_id;
                $coursePermission->folio_course_listing_id = $course['folio_course_listing_id'];
                $coursePermission->course_title = $course['course_title'];
                $coursePermission->term_id = $course['term_id'];
                if (!$coursePermission->save()) {
                    throw new BadRequestHttpException('Unable to save proxy course permission');
                }
            }

            if (!$permission->logActivity('invited', null, [
                'invited_by_user_id' => $actor['user_id'],
                'invited_by_role' => $actor['role'],
                'proxy_email' => $email,
            ])) {
                throw new ServerErrorHttpException('Unable to record proxy invitation');
            }

            // TODO(API-045): Queue invitation email; the faculty form receives the link until then.
            $this->sendInvitationEmail($permission);
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->getIsActive()) {
                $transaction->rollBack();
            }
            throw $exception;
        }

        return [
            'success' => true,
            'invitation_url' => $this->invitationUrl($permission->invitation_token),
            'permission' => $this->presenter->grant($permission),
        ];
    }

    public function accept($token, array $actor)
    {
        if (empty($actor['user_id'])) {
            throw new ForbiddenHttpException('Authentication required');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $row = Yii::$app->db->createCommand(
                'SELECT permission_id FROM faculty_proxy_permissions WHERE invitation_token = :token FOR UPDATE',
                [':token' => $token]
            )->queryOne();
            $permission = $row ? FacultyProxyPermission::findOne($row['permission_id']) : null;
            if (!$permission) {
                throw new NotFoundHttpException('Invitation not found');
            }
            if ($permission->status !== FacultyProxyPermission::STATUS_PENDING) {
                throw new ConflictHttpException('Invitation has already been used');
            }
            if (empty($permission->invitation_expires_at) || strtotime($permission->invitation_expires_at) <= time()) {
                throw new GoneHttpException('Invitation has expired');
            }
            if ($permission->faculty_shibboleth_id === $actor['user_id']) {
                throw new ConflictHttpException('Faculty members cannot accept their own invitation');
            }
            if (FacultyProxyPermission::find()->where([
                'faculty_shibboleth_id' => $permission->faculty_shibboleth_id,
                'proxy_shibboleth_id' => $actor['user_id'],
            ])->exists()) {
                throw new ConflictHttpException('This account already has a grant from the faculty member');
            }

            $permission->proxy_shibboleth_id = $actor['user_id'];
            if (!$permission->acceptInvitation([
                'display_name' => $actor['display_name'] ?? null,
                'email' => $actor['email'] ?? null,
            ])) {
                throw new BadRequestHttpException('Unable to accept proxy invitation');
            }
            if (!$permission->logActivity('accepted', null, [
                'accepted_by_user_id' => $actor['user_id'],
                'accepted_by_role' => $actor['role'] ?? null,
            ])) {
                throw new ServerErrorHttpException('Unable to record proxy acceptance');
            }
            $transaction->commit();
        } catch (\yii\db\IntegrityException $exception) {
            if ($transaction->getIsActive()) {
                $transaction->rollBack();
            }
            throw new ConflictHttpException('This account already has a grant from the faculty member');
        } catch (\Throwable $exception) {
            if ($transaction->getIsActive()) {
                $transaction->rollBack();
            }
            throw $exception;
        }

        return [
            'success' => true,
            'permission' => $this->presenter->grant($permission),
        ];
    }

    public function validateToken($token)
    {
        $permission = FacultyProxyPermission::find()
            ->where([
                'invitation_token' => $token,
                'status' => FacultyProxyPermission::STATUS_PENDING,
            ])
            ->with('coursePermissions')
            ->one();
        if (!$permission || empty($permission->invitation_expires_at) ||
            strtotime($permission->invitation_expires_at) <= time()
        ) {
            return ['valid' => false, 'message' => 'Invalid or expired invitation token'];
        }

        return ['valid' => true, 'invitation' => $this->presenter->invitation($permission)];
    }

    private function invitationUrl($token)
    {
        return rtrim($this->facultyFormUrl(), '/') . '/faculty/accept-proxy-invitation/' . rawurlencode($token);
    }

    private function facultyFormUrl()
    {
        $facultyFormUrl = Yii::$app->params['facultyFormUrl'] ?? null;
        if (!$facultyFormUrl) {
            throw new ServerErrorHttpException('Faculty form URL is not configured');
        }
        return $facultyFormUrl;
    }

    private function sendInvitationEmail(FacultyProxyPermission $permission)
    {
        // Reserved as a no-op hook until API-045 provides the email outbox.
    }

}

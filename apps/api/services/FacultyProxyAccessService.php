<?php

namespace app\services;

use app\components\Roles;
use app\models\FacultyProxyActivityLog;
use app\models\FacultyProxyPermission;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

/**
 * Lists proxy grants and activity and applies grant revocation permissions.
 */
class FacultyProxyAccessService
{
    private $presenter;

    public function __construct($presenter = null)
    {
        $this->presenter = $presenter ?: new FacultyProxyPresenter();
    }

    public function myProxies($facultyId)
    {
        $grants = FacultyProxyPermission::find()
            ->where(['faculty_shibboleth_id' => $facultyId])
            ->with('coursePermissions')
            ->orderBy(['created_at' => SORT_DESC])
            ->all();
        return ['items' => $this->presentGrants($grants), 'count' => count($grants)];
    }

    public function myFacultyAccess($proxyId)
    {
        $grants = FacultyProxyPermission::find()
            ->where([
                'proxy_shibboleth_id' => $proxyId,
                'status' => FacultyProxyPermission::STATUS_ACTIVE,
            ])
            ->with('coursePermissions')
            ->orderBy(['accepted_at' => SORT_DESC])
            ->all();
        $active = [];
        foreach ($grants as $grant) {
            if ($grant->isActive(false)) {
                $active[] = $grant;
            }
        }
        return [
            'items' => $this->presentGrants($active, true),
            'count' => count($active),
        ];
    }

    public function revoke($permissionId, array $actor)
    {
        $permission = FacultyProxyPermission::findOne($permissionId);
        if (!$permission) {
            throw new NotFoundHttpException('Proxy grant not found');
        }
        if (!Roles::isStaff($actor['role'] ?? null) &&
            $permission->faculty_shibboleth_id !== ($actor['user_id'] ?? null)
        ) {
            throw new ForbiddenHttpException('Only the granting faculty member or library staff can revoke this grant');
        }

        if ($permission->status !== FacultyProxyPermission::STATUS_REVOKED) {
            $transaction = \Yii::$app->db->beginTransaction();
            try {
                if (!$permission->revoke()) {
                    throw new BadRequestHttpException('Unable to revoke proxy grant');
                }
                if (!$permission->logActivity('revoked', null, [
                    'revoked_by_user_id' => $actor['user_id'] ?? null,
                    'revoked_by_role' => $actor['role'] ?? null,
                ])) {
                    throw new BadRequestHttpException('Unable to record proxy revocation');
                }
                $transaction->commit();
            } catch (\Throwable $exception) {
                if ($transaction->getIsActive()) {
                    $transaction->rollBack();
                }
                throw $exception;
            }
        }

        return ['success' => true, 'message' => 'Proxy access revoked'];
    }

    public function staffGrants($status = null, $facultyId = null)
    {
        $query = FacultyProxyPermission::find()->with('coursePermissions');
        if ($status !== null && $status !== '') {
            if (!in_array($status, array_keys(FacultyProxyPermission::getStatusOptions()), true)) {
                throw new BadRequestHttpException('Invalid status filter');
            }
            $query->andWhere(['status' => $status]);
        }
        if ($facultyId !== null && $facultyId !== '') {
            $query->andWhere(['faculty_shibboleth_id' => $facultyId]);
        }

        $grants = $query->orderBy(['created_at' => SORT_DESC])->all();
        return ['items' => $this->presentGrants($grants, true), 'count' => count($grants)];
    }

    public function staffActivityLog($facultyId = null)
    {
        $query = FacultyProxyActivityLog::find();
        if ($facultyId !== null && $facultyId !== '') {
            $query->where(['faculty_shibboleth_id' => $facultyId]);
        }
        $entries = $query->orderBy(['created_at' => SORT_DESC])->all();
        return ['items' => $this->presentActivity($entries), 'count' => count($entries)];
    }

    public function activityLog(array $actor, $facultyId = null)
    {
        $actorId = $actor['user_id'];
        $query = FacultyProxyActivityLog::find();
        if ($facultyId !== null && $facultyId !== '') {
            $grant = FacultyProxyPermission::find()
                ->where([
                    'faculty_shibboleth_id' => $facultyId,
                    'proxy_shibboleth_id' => $actorId,
                    'status' => FacultyProxyPermission::STATUS_ACTIVE,
                ])
                ->one();
            $canView = $facultyId === $actorId || ($grant && $grant->isActive(false));
            if (!$canView) {
                throw new ForbiddenHttpException('Access denied to this activity log');
            }
            $query->where(['faculty_shibboleth_id' => $facultyId]);
        } else {
            $query->where([
                'or',
                ['faculty_shibboleth_id' => $actorId],
                ['proxy_shibboleth_id' => $actorId],
            ]);
        }
        $entries = $query->orderBy(['created_at' => SORT_DESC])->all();
        return ['items' => $this->presentActivity($entries), 'count' => count($entries)];
    }

    public function canActAsProxy($actor, $facultyId, $courseId = null)
    {
        $permission = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $facultyId,
                'proxy_shibboleth_id' => $actor['user_id'],
                'status' => FacultyProxyPermission::STATUS_ACTIVE,
            ])
            ->one();
        if (!$permission || !$permission->isActive(false)) {
            return ['can_act_as_proxy' => false, 'reason' => 'No active permission found'];
        }

        $canAccess = !$courseId || $permission->canAccessCourse($courseId, false);
        return [
            'can_act_as_proxy' => $canAccess,
            'can_edit' => $canAccess && $permission->canEdit(false),
            'permission_type' => $permission->permission_type,
            'faculty_name' => $permission->faculty_display_name,
        ];
    }

    private function presentGrants(array $grants, $includeFacultyId = false)
    {
        $items = [];
        foreach ($grants as $grant) {
            $items[] = $this->presenter->grant($grant, $includeFacultyId);
        }
        return $items;
    }

    private function presentActivity(array $entries)
    {
        $items = [];
        foreach ($entries as $entry) {
            $items[] = $this->presenter->activity($entry);
        }
        return $items;
    }
}

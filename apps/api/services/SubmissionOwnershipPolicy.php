<?php

namespace app\services;

use app\models\FacultyProxyPermission;
use app\models\FacultySubmission;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

/**
 * Resolves submission ownership and applies the shared faculty proxy rule.
 */
class SubmissionOwnershipPolicy
{
    /**
     * Resolve the owner from the token actor and an optional authorized target.
     *
     * @return array owner_id, is_proxy and permission
     */
    public function resolveOwner($actorId, $actingForFacultyId, $folioCourseListingId)
    {
        if ($actingForFacultyId === null || $actingForFacultyId === '' || $actingForFacultyId === $actorId) {
            return [
                'owner_id' => $actorId,
                'is_proxy' => false,
                'permission' => null,
            ];
        }

        $permission = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $actingForFacultyId,
                'proxy_shibboleth_id' => $actorId,
                'status' => FacultyProxyPermission::STATUS_ACTIVE,
            ])
            ->one();

        if (!$permission || !$permission->isActive(false)) {
            throw new ForbiddenHttpException('No active proxy permission for this faculty member');
        }

        if (!$permission->canAccessCourse($folioCourseListingId, false)) {
            throw new ForbiddenHttpException('No permission to access this specific course');
        }

        if (!$permission->canEdit(false)) {
            throw new ForbiddenHttpException('Only view access - cannot create submissions');
        }

        return [
            'owner_id' => $actingForFacultyId,
            'is_proxy' => true,
            'permission' => $permission,
        ];
    }

    /**
     * Check whether an actor can read or edit a submission as owner or proxy.
     */
    public function canAccess($submission, $actorId, $requireEdit = false)
    {
        if ($submission->shibboleth_user_id === $actorId) {
            return true;
        }

        $permission = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $submission->shibboleth_user_id,
                'proxy_shibboleth_id' => $actorId,
                'status' => FacultyProxyPermission::STATUS_ACTIVE,
            ])
            ->one();

        if (!$permission || !$permission->isActive()) {
            return false;
        }

        if (!$permission->canAccessCourse($submission->folio_course_listing_id)) {
            return false;
        }

        return !$requireEdit || $permission->canEdit();
    }

    /**
     * Find a submission and enforce the shared owner/proxy access rule.
     */
    public function findSubmissionWithProxyAccess($id, $actorId, $requireEdit = false)
    {
        $submission = FacultySubmission::findOne($id);

        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        if (!$this->canAccess($submission, $actorId, $requireEdit)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }

        return $submission;
    }

    /**
     * Updates cannot change owner, proxy, or course identity fields.
     */
    public function assertUpdateDoesNotChangeOwnership(array $data)
    {
        $protectedFields = [
            'shibboleth_user_id',
            'proxy_shibboleth_user_id',
            'proxy_display_name',
            'acting_for_faculty_id',
            'term_code',
            'course_code',
            'section',
            'folio_course_listing_id',
        ];

        foreach ($protectedFields as $field) {
            if (array_key_exists($field, $data)) {
                throw new BadRequestHttpException(
                    'Ownership and course identity fields cannot be changed through update.'
                );
            }
        }
    }
}

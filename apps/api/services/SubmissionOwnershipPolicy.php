<?php

namespace app\services;

use app\components\Roles;
use app\models\FacultyProxyPermission;
use app\models\FacultySubmission;
use yii\db\Expression;
use yii\db\Query;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

/**
 * Resolves submission ownership and applies faculty roster and proxy access rules.
 */
class SubmissionOwnershipPolicy
{
    private $rosterService;

    public function __construct($rosterService = null)
    {
        $this->rosterService = $rosterService ?: new CourseRosterService();
    }

    /**
     * Resolve the owner from the actor, course roster, and optional proxy target.
     *
     * @return array owner_id, is_proxy and permission
     */
    public function resolveOwner(array $actor, $actingForFacultyId, $folioCourseListingId, array $course)
    {
        $actorId = $actor['user_id'];
        $isStaff = Roles::isStaff($actor['role'] ?? null);
        $isActingForOther = $actingForFacultyId !== null && $actingForFacultyId !== '' &&
            $actingForFacultyId !== $actorId;

        if ($isStaff) {
            return [
                'owner_id' => $isActingForOther ? $actingForFacultyId : $actorId,
                'is_proxy' => $isActingForOther,
                'permission' => null,
            ];
        }

        if (!$isActingForOther) {
            $termCode = $course['term'] ?? $course['term_code'] ?? null;
            $courseCode = $course['courseCode'] ?? $course['course_code'] ?? null;
            $section = $course['section'] ?? null;
            if (!$this->rosterService->isInstructorRostered(
                $actor['internal_id'] ?? null,
                $termCode,
                $courseCode,
                $section
            )) {
                throw new ForbiddenHttpException(
                    'course not found on your teaching roster; contact library staff'
                );
            }

            return [
                'owner_id' => $actorId,
                'is_proxy' => false,
                'permission' => null,
            ];
        }

        $permission = $this->findPermission($actingForFacultyId, $actorId);
        if (!$permission || !$permission->isActive(false)) {
            throw new ForbiddenHttpException('No active proxy permission for this faculty member');
        }

        if (!$permission->canAccessCourse($folioCourseListingId, false)) {
            throw new ForbiddenHttpException('No permission to access this specific course');
        }

        if (!$permission->canEdit(false)) {
            throw new ForbiddenHttpException('Only view access - cannot create submissions');
        }

        $permission->logActivity('acted_for', null, [
            'folio_course_listing_id' => $folioCourseListingId,
        ]);

        return [
            'owner_id' => $actingForFacultyId,
            'is_proxy' => true,
            'permission' => $permission,
        ];
    }

    /**
     * A co-instructor listed for a course may open and edit another instructor's submission.
     */
    public function isRosteredCoInstructor($submission, array $actor)
    {
        if ($submission->shibboleth_user_id === $actor['user_id']) {
            return false;
        }

        return $this->rosterService->isInstructorRostered(
            $actor['internal_id'] ?? null,
            $submission->term_code,
            $submission->course_code,
            $submission->section
        );
    }

    /**
     * Check whether an actor can read or edit a submission as owner, staff, proxy, or co-instructor.
     */
    public function canAccess($submission, array $actor, $requireEdit = false)
    {
        if ($submission->shibboleth_user_id === $actor['user_id']) {
            return true;
        }

        if (Roles::isStaff($actor['role'] ?? null)) {
            return true;
        }

        $permission = $this->findPermission($submission->shibboleth_user_id, $actor['user_id']);
        if ($permission && $permission->isActive(false) &&
            $permission->canAccessCourse($submission->folio_course_listing_id, false) &&
            (!$requireEdit || $permission->canEdit(false))) {
            return true;
        }

        return $this->isRosteredCoInstructor($submission, $actor);
    }

    /**
     * Query the submissions available to an actor without loading inaccessible rows.
     */
    public function accessibleSubmissionsQuery(array $actor)
    {
        $actorId = $actor['user_id'];
        $query = FacultySubmission::find()->alias('submission');
        $ownerCondition = ['submission.shibboleth_user_id' => $actorId];

        if (Roles::isStaff($actor['role'] ?? null)) {
            $activeGrantOwners = (new Query())
                ->select('staff_permission.faculty_shibboleth_id')
                ->from(['staff_permission' => FacultyProxyPermission::tableName()])
                ->where(['staff_permission.proxy_shibboleth_id' => $actorId])
                ->andWhere(['staff_permission.status' => FacultyProxyPermission::STATUS_ACTIVE]);

            return $query->where([
                'or',
                $ownerCondition,
                ['in', 'submission.shibboleth_user_id', $activeGrantOwners],
            ]);
        }

        $proxyPermission = (new Query())
            ->select(new Expression('1'))
            ->from(['proxy_permission' => FacultyProxyPermission::tableName()])
            ->where('proxy_permission.faculty_shibboleth_id = submission.shibboleth_user_id')
            ->andWhere(['proxy_permission.proxy_shibboleth_id' => $actorId])
            ->andWhere(['proxy_permission.status' => FacultyProxyPermission::STATUS_ACTIVE])
            ->andWhere([
                'or',
                ['proxy_permission.expires_at' => null],
                ['>=', 'proxy_permission.expires_at', date('Y-m-d H:i:s')],
            ])
            ->andWhere(FacultyProxyPermission::courseScopeCondition(
                'proxy_permission',
                new Expression('submission.folio_course_listing_id')
            ));

        $accessConditions = [$ownerCondition, ['exists', $proxyPermission]];
        $rosteredConditions = $this->rosteredSubmissionConditions($actor);
        if (!empty($rosteredConditions)) {
            $accessConditions[] = array_merge(['or'], $rosteredConditions);
        }

        return $query->where(array_merge(['or'], $accessConditions));
    }

    /**
     * Describe why a listed row is available to the current actor.
     */
    public function accessDetails($submission, array $actor)
    {
        if ($submission->shibboleth_user_id === $actor['user_id']) {
            return ['access' => 'owner'];
        }

        $permission = $this->findPermission($submission->shibboleth_user_id, $actor['user_id']);
        if (Roles::isStaff($actor['role'] ?? null)) {
            if ($permission) {
                return [
                    'access' => 'proxy',
                    'proxy_can_edit' => $permission->canEdit(false),
                ];
            }
        } elseif ($permission && $permission->isActive(false) &&
            $permission->canAccessCourse($submission->folio_course_listing_id, false)) {
            return [
                'access' => 'proxy',
                'proxy_can_edit' => $permission->canEdit(false),
            ];
        }

        return ['access' => 'co_instructor'];
    }

    /**
     * Find a submission and enforce the shared access rule.
     */
    public function findSubmissionWithAccess($id, array $actor, $requireEdit = false, array $with = [])
    {
        $query = FacultySubmission::find();
        if (preg_match('/^[0-9a-f-]{36}$/i', (string)$id)) {
            $query->where(['submission_uuid' => $id]);
        } else {
            $query->where(['submission_id' => $id]);
        }

        $submission = $query->with($with)->one();
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        if (!$this->canAccess($submission, $actor, $requireEdit)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }

        return $submission;
    }

    private function findPermission($ownerId, $actorId)
    {
        return FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $ownerId,
                'proxy_shibboleth_id' => $actorId,
                'status' => FacultyProxyPermission::STATUS_ACTIVE,
            ])
            ->one();
    }

    private function rosteredSubmissionConditions(array $actor)
    {
        $courses = $this->rosterService->getInstructorSubmissionCourses($actor['internal_id'] ?? null);
        $conditions = [];

        foreach ($courses as $index => $course) {
            $termParameter = ':roster_term_' . $index;
            $courseParameter = ':roster_course_' . $index;
            $sectionParameter = ':roster_section_' . $index;
            $conditions[] = new Expression(
                'BINARY `submission`.`term_code` = BINARY ' . $termParameter
                . ' AND BINARY REGEXP_REPLACE(TRIM(`submission`.`course_code`), '
                . "'[[:space:]]+', ' ') = BINARY " . $courseParameter
                . ' AND BINARY TRIM(`submission`.`section`) = BINARY ' . $sectionParameter,
                [
                    $termParameter => $course['term_code'],
                    $courseParameter => $course['course_code'],
                    $sectionParameter => $course['section'],
                ]
            );
        }

        return $conditions;
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

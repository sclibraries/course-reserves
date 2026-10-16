<?php

namespace app\services;

use app\components\Roles;
use app\models\FacultyProxyPermission;
use app\models\FacultySubmission;
use yii\db\Expression;
use yii\db\Query;

/**
 * Builds the database query for submissions visible to one authenticated actor.
 */
class AccessibleSubmissionQueryBuilder
{
    private $rosterService;

    public function __construct($rosterService = null)
    {
        $this->rosterService = $rosterService ?: new CourseRosterService();
    }

    public function build(array $actor)
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
}

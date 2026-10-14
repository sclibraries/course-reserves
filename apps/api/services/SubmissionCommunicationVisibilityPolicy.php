<?php

namespace app\services;

use app\models\SubmissionCommunication;
use yii\web\BadRequestHttpException;

class SubmissionCommunicationVisibilityPolicy
{
    public function facultyCondition()
    {
        return ['visibility' => SubmissionCommunication::VISIBILITY_FACULTY];
    }

    public function isFacultyVisible($visibility)
    {
        return $visibility === SubmissionCommunication::VISIBILITY_FACULTY;
    }

    public function staffDefaultVisibility()
    {
        return SubmissionCommunication::VISIBILITY_STAFF_ONLY;
    }

    public function resolveStaffVisibility($parent, $requestedVisibility)
    {
        if ($parent) {
            $visibility = $requestedVisibility === null
                ? $parent->visibility
                : $requestedVisibility;
            $this->assertReplyMatchesParent($parent, $visibility);
            return $visibility;
        }

        return $requestedVisibility === null
            ? $this->staffDefaultVisibility()
            : $requestedVisibility;
    }

    public function assertReplyMatchesParent($parent, $visibility)
    {
        if ($parent && $parent->visibility !== $visibility) {
            throw new BadRequestHttpException('Reply visibility must match the parent thread.');
        }
    }
}

<?php

namespace app\services;

use Yii;

/** Returns the shared API error response when processing starts before course linking. */
class SubmissionLinkGuard
{
    public static function errorResponse($submission)
    {
        if ($submission && $submission->status === \app\models\FacultySubmission::STATUS_DRAFT) {
            Yii::$app->response->statusCode = 409;
            return ['error_code' => 'submission_not_submitted'];
        }
        if ($submission && $submission->link_state === 'linked') {
            return null;
        }

        Yii::$app->response->statusCode = 409;
        return ['error_code' => 'submission_not_linked'];
    }
}

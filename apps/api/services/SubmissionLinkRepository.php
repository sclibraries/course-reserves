<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use yii\web\NotFoundHttpException;

/** Loads a submission under a row lock for link and correction transactions. */
class SubmissionLinkRepository
{
    public function findForUpdate($uuid)
    {
        $row = Yii::$app->db->createCommand(
            'SELECT * FROM {{%faculty_submissions}} WHERE [[submission_uuid]] = :uuid FOR UPDATE',
            [':uuid' => $uuid]
        )->queryOne();
        if (!$row) throw new NotFoundHttpException('Submission not found.');

        $submission = FacultySubmission::instantiate($row);
        FacultySubmission::populateRecord($submission, $row);
        $submission->afterFind();
        return $submission;
    }
}

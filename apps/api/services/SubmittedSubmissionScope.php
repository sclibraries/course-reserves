<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;

/** Centralizes read scoping and action guards for staff submitted-work surfaces. */
class SubmittedSubmissionScope
{
    public static function sqlPredicate($alias)
    {
        return $alias . '.status <> "' . FacultySubmission::STATUS_DRAFT . '"';
    }

    public function excludeDrafts($query, $alias = 'faculty_submissions')
    {
        $query->andWhere(['<>', $alias . '.status', FacultySubmission::STATUS_DRAFT]);
        return $query;
    }

    public function staffSubmissionList($query, $alias = 'faculty_submissions')
    {
        $query->andWhere([$alias . '.status' => [
            FacultySubmission::STATUS_DRAFT,
            FacultySubmission::STATUS_SUBMITTED,
        ]]);
        return $query;
    }

    public function guardStatus($status)
    {
        if ($status !== FacultySubmission::STATUS_DRAFT) {
            return null;
        }
        Yii::$app->response->statusCode = 409;
        return ['error_code' => 'submission_not_submitted'];
    }

    public function guardServiceResult($status, $transaction)
    {
        if (!$body = $this->guardStatus($status)) {
            return null;
        }
        $transaction->rollBack();
        return ['status' => 409, 'body' => $body];
    }

    public function isDraft($submissionId)
    {
        return FacultySubmission::find()->where([
            'submission_id' => $submissionId,
            'status' => FacultySubmission::STATUS_DRAFT,
        ])->exists();
    }

    public function guard($submissionId)
    {
        if ($this->isDraft($submissionId)) {
            Yii::$app->response->statusCode = 409;
            return ['error_code' => 'submission_not_submitted'];
        }
        return null;
    }
}

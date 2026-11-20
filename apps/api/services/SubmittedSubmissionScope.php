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

    public function blockedBodyForStatus($status)
    {
        if ($status !== FacultySubmission::STATUS_DRAFT) {
            return null;
        }
        return ['error_code' => 'submission_not_submitted'];
    }

    public function guardStatus($status)
    {
        $body = $this->blockedBodyForStatus($status);
        if ($body !== null) {
            Yii::$app->response->statusCode = 409;
        }
        return $body;
    }

    public function guardServiceResult($status, $transaction)
    {
        if (!$body = $this->blockedBodyForStatus($status)) {
            return null;
        }
        Yii::$app->response->statusCode = 409;
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
        return $this->isDraft($submissionId)
            ? $this->guardStatus(FacultySubmission::STATUS_DRAFT)
            : null;
    }
}

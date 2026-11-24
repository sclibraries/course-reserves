<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use app\models\SubmissionFolder;
use app\models\SubmissionNewResource;
use app\models\SubmissionReuseResource;

/** Locks and projects the submission state needed by a faculty save attempt. */
class FacultySaveContext
{
    public function load($submissionId, $evaluatedAt)
    {
        $this->requireTransaction();
        $submission = FacultySubmission::findBySql(
            'SELECT * FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
            [':id' => (int)$submissionId]
        )->one();
        if (!$submission) {
            return null;
        }

        $newItems = SubmissionNewResource::findBySql(
            'SELECT * FROM submission_new_resources WHERE submission_id = :id ORDER BY id FOR UPDATE',
            [':id' => (int)$submissionId]
        )->indexBy('id')->all();
        $reuseItems = SubmissionReuseResource::findBySql(
            'SELECT * FROM submission_reuse_resources WHERE submission_id = :id ORDER BY id FOR UPDATE',
            [':id' => (int)$submissionId]
        )->asArray()->indexBy('id')->all();
        $folders = SubmissionFolder::findBySql(
            'SELECT * FROM submission_folders WHERE submission_id = :id ORDER BY folder_id FOR UPDATE',
            [':id' => (int)$submissionId]
        )->asArray()->indexBy('folder_id')->all();

        $itemAttributes = [
            'new' => array_map(function ($item) {
                return $item->getAttributes();
            }, $newItems),
            'reuse' => $reuseItems,
        ];
        $idsByKind = [
            'new' => array_keys($newItems),
            'reuse' => array_keys($reuseItems),
        ];

        return [
            'submission' => $submission,
            'items' => ['new' => $newItems, 'reuse' => $reuseItems],
            'item_attributes' => $itemAttributes,
            'folders' => $folders,
            'grouping' => (new FacultyFolderGrouping())->group(array_values($folders), $itemAttributes),
            'evidence' => (new FacultyItemEvidenceReader())->forItems($idsByKind, true),
            'evaluated_at' => $evaluatedAt,
        ];
    }

    private function requireTransaction()
    {
        $transaction = Yii::$app->db->getTransaction();
        if ($transaction === null || !$transaction->isActive) {
            throw new \LogicException('Faculty save context requires an active transaction.');
        }
    }
}

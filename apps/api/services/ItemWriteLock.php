<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use app\models\SubmissionNewResource;
use app\models\SubmissionReuseResource;

/** Acquires current submission and item rows in their shared lock order. */
class ItemWriteLock
{
    private $items;

    public function __construct(ItemClaimRepository $items = null)
    {
        $this->items = $items ?: new ItemClaimRepository();
    }

    public function lock($kind, $itemId)
    {
        $submissionId = $this->discoverSubmissionId($kind, $itemId);
        if ($submissionId === null) {
            return $this->missing($kind, null, 'item');
        }
        return $this->lockDiscovered($kind, $itemId, $submissionId);
    }

    public function discoverSubmissionId($kind, $itemId)
    {
        $table = $this->items->table($kind);
        $this->requireTransaction();
        $submissionId = Yii::$app->db->createCommand(
            'SELECT submission_id FROM ' . $table . ' WHERE id = :id LIMIT 1',
            [':id' => (int)$itemId]
        )->queryScalar();
        return $submissionId === false || $submissionId === null ? null : (int)$submissionId;
    }

    public function lockDiscovered($kind, $itemId, $submissionId)
    {
        $table = $this->items->table($kind);
        $this->requireTransaction();
        if ($submissionId === null) {
            return $this->missing($kind, null, 'item');
        }

        $submission = FacultySubmission::findBySql(
            'SELECT * FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
            [':id' => (int)$submissionId]
        )->one();
        $model = $kind === 'new' ? SubmissionNewResource::class : SubmissionReuseResource::class;
        $item = $model::findBySql(
            'SELECT * FROM ' . $table . ' WHERE id = :id FOR UPDATE',
            [':id' => (int)$itemId]
        )->one();
        if (!$item) {
            return $this->missing($kind, $submissionId, 'item');
        }
        if ((int)$item->submission_id !== (int)$submissionId) {
            throw new ItemAssociationChanged('The item moved during processing.');
        }
        if (!$submission) {
            return $this->missing($kind, $submissionId, 'submission');
        }

        return [
            'kind' => $kind,
            'submission_id' => (int)$submissionId,
            'submission' => $submission,
            'item' => $item,
            'missing' => null,
        ];
    }

    private function requireTransaction()
    {
        $transaction = Yii::$app->db->getTransaction();
        if ($transaction === null || !$transaction->isActive) {
            throw new \LogicException('ItemWriteLock requires an active transaction.');
        }
    }

    private function missing($kind, $submissionId, $missing)
    {
        return [
            'kind' => $kind,
            'submission_id' => $submissionId === null ? null : (int)$submissionId,
            'submission' => null,
            'item' => null,
            'missing' => $missing,
        ];
    }
}

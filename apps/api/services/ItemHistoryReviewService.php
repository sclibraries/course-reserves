<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use yii\helpers\ArrayHelper;

/** Atomically records staff decisions for flagged new items. */
class ItemHistoryReviewService
{
    use ServiceResult;
    use ItemHistoryReviewFailure;

    const MAX_REASON_BYTES = 65535;

    public function review($itemId, array $actor, $reviewerId, $decision, $reason)
    {
        $validation = $this->validate($decision, $reason);
        if ($validation !== null) {
            return $validation;
        }
        $reason = trim($reason);

        return Transactional::retrying(function () use ($itemId, $actor, $reviewerId, $decision, $reason) {
            $locked = (new ItemWriteLock())->lock('new', $itemId);
            if ($locked['missing'] !== null) {
                return $this->failure(404, $locked['missing'] === 'submission'
                    ? 'submission_not_found' : 'item_not_found');
            }

            $submission = $locked['submission'];
            if ((new SubmittedSubmissionScope())->blockedBodyForStatus($submission->status) !== null) {
                return $this->failure(409, 'submission_not_submitted');
            }

            $review = Yii::$app->db->createCommand(
                'SELECT * FROM item_history_review WHERE item_id = :id FOR UPDATE',
                [':id' => (int)$itemId]
            )->queryOne();
            if (!$review || (int)$review['submission_id'] !== (int)$submission->submission_id) {
                return $this->failure(404, 'history_review_not_found');
            }
            if ($review['reviewed_at'] !== null) {
                return $this->failure(409, 'already_reviewed');
            }

            $now = date('Y-m-d H:i:s');
            $this->writeReview($itemId, $locked, $review, $actor, $reviewerId, $decision, $reason, $now);

            return $this->result(200, [
                'item_id' => (int)$itemId,
                'submission_id' => (int)$submission->submission_id,
                'decision' => $decision,
                'reviewed_at' => $now,
            ]);
        });
    }

    public function reviewSubmission($submissionId, array $actor, $reviewerId, $decision, $reason)
    {
        $validation = $this->validate($decision, $reason);
        if ($validation !== null) {
            return $validation;
        }
        $reason = trim($reason);

        return Transactional::retrying(function () use ($submissionId, $actor, $reviewerId, $decision, $reason) {
            $submission = FacultySubmission::findBySql(
                'SELECT * FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => (int)$submissionId]
            )->one();
            if (!$submission) {
                return $this->failure(404, 'submission_not_found');
            }
            if ((new SubmittedSubmissionScope())->blockedBodyForStatus($submission->status) !== null) {
                return $this->failure(409, 'submission_not_submitted');
            }

            $submissionId = (int)$submission->submission_id;
            $candidateIds = Yii::$app->db->createCommand(
                'SELECT review.item_id FROM item_history_review review '
                . 'INNER JOIN submission_new_resources item ON item.id = review.item_id '
                . 'WHERE review.submission_id = :review_submission_id AND item.submission_id = :item_submission_id '
                . 'ORDER BY review.item_id',
                [':review_submission_id' => $submissionId, ':item_submission_id' => $submissionId]
            )->queryColumn();

            $itemLocks = new ItemWriteLock();
            $lockedItems = [];
            foreach ($candidateIds as $candidateId) {
                $itemId = (int)$candidateId;
                $locked = $itemLocks->lockDiscovered('new', $itemId, $submissionId);
                if ($locked['missing'] === null) {
                    $lockedItems[$itemId] = $locked;
                }
            }

            if (!$lockedItems) {
                return $this->failure(404, 'history_review_not_found');
            }
            $reviews = ArrayHelper::index(Yii::$app->db->createCommand(
                'SELECT * FROM item_history_review WHERE submission_id = :submission_id AND item_id IN ('
                . implode(',', array_keys($lockedItems)) . ') ORDER BY item_id FOR UPDATE',
                [':submission_id' => $submissionId]
            )->queryAll(), 'item_id');
            if (!$reviews) {
                return $this->failure(404, 'history_review_not_found');
            }

            $openReviews = array_filter($reviews, function ($review) {
                return $review['reviewed_at'] === null;
            });
            if (!$openReviews) {
                return $this->failure(409, 'already_reviewed');
            }

            $now = date('Y-m-d H:i:s');
            foreach ($openReviews as $itemId => $review) {
                $this->writeReview(
                    $itemId,
                    $lockedItems[$itemId],
                    $review,
                    $actor,
                    $reviewerId,
                    $decision,
                    $reason,
                    $now
                );
            }

            return $this->result(200, [
                'submission_id' => $submissionId,
                'decision' => $decision,
                'reviewed_count' => count($openReviews),
            ]);
        });
    }

    private function validate($decision, $reason)
    {
        if (!is_string($decision) || !in_array($decision, ['finished', 'not_finished'], true)) {
            return $this->failure(422, 'invalid_review_decision');
        }
        if (!is_string($reason)) {
            return $this->failure(422, 'invalid_review_reason');
        }
        $trimmedReason = trim($reason);
        if ($trimmedReason === '') {
            return $this->failure(422, 'invalid_review_reason');
        }
        if (strlen($trimmedReason) > self::MAX_REASON_BYTES) {
            return $this->failure(422, 'review_reason_too_long');
        }
        return null;
    }

    private function writeReview($itemId, array $locked, array $review, array $actor, $reviewerId, $decision, $reason, $now)
    {
        $beforeLatch = $locked['item']->locked_for_faculty_at;
        $afterLatch = $beforeLatch;
        if ($decision === 'finished') {
            (new FacultyLockLatch())->set('new', $itemId, $now);
            $afterLatch = $beforeLatch === null ? $now : $beforeLatch;
        }

        Yii::$app->db->createCommand()->update('item_history_review', [
            'reviewed_at' => $now,
            'reviewed_by_staff_id' => (string)$reviewerId,
            'decision' => $decision,
            'reason' => $reason,
        ], ['item_id' => (int)$itemId])->execute();

        (new WorkflowEventLog())->record(
            (int)$locked['submission']->submission_id,
            (int)$itemId,
            $actor,
            'history_reviewed',
            $reason,
            ['decision' => $review['decision'], 'locked_for_faculty_at' => $beforeLatch],
            ['decision' => $decision, 'locked_for_faculty_at' => $afterLatch],
            'new'
        );
    }
}

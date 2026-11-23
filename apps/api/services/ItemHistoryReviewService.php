<?php

namespace app\services;

use Yii;

/** Atomically records the staff decision for one flagged new item. */
class ItemHistoryReviewService
{
    use ServiceResult;

    const MAX_REASON_BYTES = 65535;

    public function review($itemId, array $actor, $reviewerId, $decision, $reason)
    {
        if (!is_string($decision) || !in_array($decision, ['finished', 'not_finished'], true)) {
            return $this->failure(422, 'invalid_review_decision');
        }
        if (!is_string($reason)) {
            return $this->failure(422, 'invalid_review_reason');
        }
        $reason = trim($reason);
        if ($reason === '') {
            return $this->failure(422, 'invalid_review_reason');
        }
        if (strlen($reason) > self::MAX_REASON_BYTES) {
            return $this->failure(422, 'review_reason_too_long');
        }

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
                (int)$submission->submission_id,
                (int)$itemId,
                $actor,
                'history_reviewed',
                $reason,
                ['decision' => $review['decision'], 'locked_for_faculty_at' => $beforeLatch],
                ['decision' => $decision, 'locked_for_faculty_at' => $afterLatch],
                'new'
            );

            return $this->result(200, [
                'item_id' => (int)$itemId,
                'submission_id' => (int)$submission->submission_id,
                'decision' => $decision,
                'reviewed_at' => $now,
            ]);
        });
    }

    private function failure($status, $code)
    {
        $reference = FailureReference::generate();
        Yii::warning('Item history review ' . $code . ' reference=' . $reference, __METHOD__);
        return $this->result($status, [
            'error_code' => $code,
            'message' => 'The item history review could not be completed.',
            'reference' => $reference,
        ]);
    }
}

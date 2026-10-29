<?php

namespace app\services;

use Yii;

/** Locks one linked item, expires its claim, and coordinates the resulting notification. */
class LinkedItemService
{
    use ServiceResult;

    private $repository;
    private $expiry;
    private $submittedScope;

    public function __construct($repository, $expiry, $submittedScope = null)
    {
        $this->repository = $repository;
        $this->expiry = $expiry;
        $this->submittedScope = $submittedScope ?: new SubmittedSubmissionScope();
    }

    public function withLinkedItem($kind, $id, callable $callback)
    {
        $outcome = Transactional::run(function ($transaction) use ($kind, $id, $callback) {
            $submissionId = $this->repository->submissionId($kind, $id);
            if (!$submissionId) {
                return $this->reject($transaction, 404, ['error_code' => 'item_not_found']);
            }
            $submission = Yii::$app->db->createCommand(
                'SELECT status, link_state FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => (int)$submissionId]
            )->queryOne();
            if (!$submission) {
                return $this->reject($transaction, 404, ['error_code' => 'item_not_found']);
            }
            if ($blocked = $this->submittedScope->guardStatus($submission['status'])) {
                return $this->reject($transaction, 409, $blocked);
            }
            if ($submission['link_state'] !== 'linked') {
                return $this->reject($transaction, 409, ['error_code' => 'submission_not_linked']);
            }
            $item = $this->repository->find($kind, $id, true);
            if (!$item) {
                return $this->reject($transaction, 404, ['error_code' => 'item_not_found']);
            }

            $now = $this->expiry->now();
            $notification = $this->expiry->expireLocked($kind, $item, $now);
            if ($notification) {
                $item = $this->repository->find($kind, $id, true);
            }
            return [
                'result' => $callback($item, $transaction, $now),
                'notification' => $transaction->isActive ? $notification : null,
            ];
        });
        $this->expiry->notify($outcome['notification']);
        return $outcome['result'];
    }

    private function reject($transaction, $status, array $body)
    {
        $transaction->rollBack();
        return ['result' => $this->result($status, $body), 'notification' => null];
    }
}

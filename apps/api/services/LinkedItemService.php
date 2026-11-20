<?php

namespace app\services;

use Yii;

/** Acquires a linked item through the shared write lock and coordinates lazy expiry. */
class LinkedItemService
{
    use ServiceResult;

    private $itemLock;
    private $projection;
    private $expiry;
    private $statusGuard;

    public function __construct($repository, $expiry, $submittedScope = null, ?callable $statusGuard = null)
    {
        $this->itemLock = new ItemWriteLock($repository);
        $this->projection = new ItemWriteLockProjection();
        $this->expiry = $expiry;
        $submittedScope = $submittedScope ?: new SubmittedSubmissionScope();
        $this->statusGuard = $statusGuard ?: [$submittedScope, 'guardStatus'];
    }

    public function withLinkedItem($kind, $id, callable $callback, ?callable $beforeProjection = null)
    {
        return Transactional::retrying(function ($transaction) use ($kind, $id, $callback, $beforeProjection) {
            $locked = $this->itemLock->lock($kind, $id);
            if ($locked['missing'] !== null) {
                return $this->reject($transaction, 404, ['error_code' => 'item_not_found']);
            }
            if ($beforeProjection !== null) {
                call_user_func($beforeProjection);
            }

            $item = $this->projection->project($locked);
            if ($blocked = call_user_func($this->statusGuard, $item['submission_status'])) {
                return $this->reject($transaction, 409, $blocked);
            }
            if ($item['link_state'] !== 'linked') {
                return $this->reject($transaction, 409, ['error_code' => 'submission_not_linked']);
            }

            $now = $this->expiry->now();
            $notification = $this->expiry->expireLocked($kind, $item, $now);
            if ($notification) {
                $notice = $notification;
                Yii::$app->get('workflowNotificationQueue')->enqueue(function () use ($notice) {
                    $this->expiry->notify($notice);
                });
                $locked = $this->itemLock->lock($kind, $id);
                if ($locked['missing'] !== null) {
                    return $this->reject($transaction, 404, ['error_code' => 'item_not_found']);
                }
                $item = $this->projection->project($locked);
            }

            return call_user_func($callback, $item, $transaction, $now);
        });
    }

    private function reject($transaction, $status, array $body)
    {
        $transaction->rollBack();
        return $this->result($status, $body);
    }
}

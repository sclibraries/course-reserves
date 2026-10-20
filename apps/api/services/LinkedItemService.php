<?php

namespace app\services;

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
            $item = $this->repository->find($kind, $id, true);
            if (!$item) {
                return $this->reject($transaction, 404, ['error_code' => 'item_not_found']);
            }
            if ($blocked = $this->submittedScope->guardStatus($item['submission_status'])) {
                return $this->reject($transaction, 409, $blocked);
            }
            if ($item['link_state'] !== 'linked') {
                return $this->reject($transaction, 409, ['error_code' => 'submission_not_linked']);
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

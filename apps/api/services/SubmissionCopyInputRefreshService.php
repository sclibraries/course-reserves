<?php

namespace app\services;

use Yii;

/** Refreshes versioned copy inputs as an explicit claimed-item draft edit. */
class SubmissionCopyInputRefreshService
{
    use ServiceResult;

    private $claims;
    private $items;
    private $publication;

    public function __construct($claims = null, $items = null, $publication = null)
    {
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->items = $items ?: new ItemClaimRepository();
        $this->publication = $publication ?: new SubmissionPublicationStateService(null, $this->claims, $this->items);
    }

    public function refresh($kind, $itemId, array $actor)
    {
        return $this->claims->withLinkedItem($kind, $itemId, function ($item, $transaction, $now) use (
            $kind, $itemId, $actor
        ) {
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $resourceId = $item['source_resource_id'] ?? null;
            $snapshot = SubmissionSourceSnapshot::capture($resourceId);
            if ($resourceId !== null && trim((string)$resourceId) !== '' && !$snapshot) {
                return $this->result(409, ['error_code' => 'source_resource_missing']);
            }
            if (!$snapshot) {
                $snapshot = SubmissionSourceSnapshot::emptySnapshot();
            }
            $previous = json_decode($item['source_snapshot_json'] ?? 'null', true);
            if (is_array($previous) && isset($previous['eds'])) {
                $snapshot['eds'] = $previous['eds'];
            }

            $this->publication->lockForWrite($kind, $itemId, $item['submission_id']);
            Yii::$app->db->createCommand()->update($this->items->table($kind), [
                'source_snapshot_json' => json_encode($snapshot, JSON_UNESCAPED_SLASHES),
                'last_activity_at' => $now,
            ], ['id' => (int)$itemId])->execute();
            $this->publication->invalidateDraft($kind, $itemId, $item['submission_id']);

            return $this->result(200, ['copy_inputs_refreshed' => true]);
        });
    }
}

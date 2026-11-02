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
            $canonicalResourceId = SourceResourceId::canonical($resourceId);
            $sourceExists = $canonicalResourceId !== null && !empty($item['source_resource_found']);
            $projection = (new SubmissionInputProjection())->project(
                $kind,
                $item,
                $item['material_type'] ?? null,
                null,
                $sourceExists
            );
            if ($projection['destination_class'] !== 'electronic' || $canonicalResourceId === null || !$sourceExists) {
                return $this->result(409, [
                    'error_code' => 'copy_input_refresh_requires_local_electronic_source',
                ]);
            }
            $snapshot = SubmissionSourceSnapshot::capture($canonicalResourceId);
            if (!$snapshot) {
                return $this->result(409, ['error_code' => 'source_resource_missing']);
            }
            $previous = json_decode($item['source_snapshot_json'] ?? 'null', true);
            if (is_array($previous)) {
                $snapshot = array_merge($previous, $snapshot);
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

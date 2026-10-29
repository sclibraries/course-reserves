<?php

namespace app\services;

use Yii;

/** Stores staff-written public notes and assigned pages without publishing an item. */
class SubmissionItemDetailsService
{
    use ServiceResult;

    private $claims;
    private $items;
    private $events;
    private $publication;

    public function __construct($claims = null, $items = null, $events = null, $publication = null)
    {
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->items = $items ?: new ItemClaimRepository();
        $this->events = $events ?: new WorkflowEventLog();
        $this->publication = $publication ?: new SubmissionPublicationStateService(
            null, $this->claims, $this->items, null, $this->events
        );
    }

    public function update($kind, $id, array $actor, array $payload)
    {
        $details = $this->normalizeDetails($payload);
        if (isset($details['error_code'])) {
            return $this->result(400, $details);
        }
        if (!$details) {
            return $this->result(400, ['error_code' => 'item_details_required']);
        }

        return $this->claims->withLinkedItem($kind, $id, function ($item, $transaction, $now) use (
            $kind, $id, $actor, $details
        ) {
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }

            $this->publication->lockForWrite($kind, $id, $item['submission_id']);
            $before = $this->detailSnapshot($item);
            $this->items->updateDetails($kind, $id, $details, $now);
            $updated = $this->items->find($kind, $id);
            $after = $this->detailSnapshot($updated);
            if ($before !== $after) {
                $this->publication->invalidateDraft($kind, $id, $item['submission_id']);
            }
            $this->events->record(
                $item['submission_id'], $id, $actor, 'item_details_updated', null, $before, $after, $kind
            );

            return $this->result(200, [
                'item' => [
                    'kind' => $kind,
                    'id' => (int)$id,
                    'public_note' => $after['public_note'],
                    'assigned_pages' => $after['assigned_pages'],
                ],
            ]);
        });
    }

    private function normalizeDetails(array $payload)
    {
        $details = [];
        foreach (['public_note', 'assigned_pages'] as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }
            $value = $payload[$field];
            if ($value !== null && !is_string($value)) {
                return ['error_code' => 'invalid_item_detail', 'field' => $field];
            }
            $value = $value === null ? null : trim($value);
            if ($value !== null && strlen($value) > 65535) {
                return ['error_code' => 'item_detail_too_long', 'field' => $field];
            }
            $details[$field] = $value === '' ? null : $value;
        }
        return $details;
    }

    private function detailSnapshot(array $item)
    {
        return [
            'public_note' => $item['public_note'] ?? null,
            'assigned_pages' => $item['assigned_pages'] ?? null,
        ];
    }
}

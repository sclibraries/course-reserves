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
    private $flows;
    private $inputProjection;
    private $itemProjection;

    public function __construct($claims = null, $items = null, $events = null, $publication = null)
    {
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->items = $items ?: new ItemClaimRepository();
        $this->events = $events ?: new WorkflowEventLog();
        $this->publication = $publication ?: new SubmissionPublicationStateService(
            null, $this->claims, $this->items, null, $this->events
        );
        $this->flows = new FlowRepository();
        $this->inputProjection = new SubmissionInputProjection();
        $this->itemProjection = new ItemWriteLockProjection();
    }

    public function update($kind, $id, array $actor, array $payload)
    {
        $details = SubmissionItemDetailsInput::normalize($payload);
        if (isset($details['error_code'])) {
            return $this->result(400, $details);
        }
        if (!$details) {
            return $this->result(400, ['error_code' => 'item_details_required']);
        }

        return $this->claims->withLinkedItem($kind, $id, function ($item, $transaction, $now) use (
            $kind, $id, $actor, $details
        ) {
            $attemptDetails = $details;
            if (isset($attemptDetails['staff_material_type_id'])
                && !$this->itemProjection->materialType($attemptDetails['staff_material_type_id'])) {
                $transaction->rollBack();
                return $this->result(400, [
                    'error_code' => 'invalid_item_detail', 'field' => 'effective_material_type_id',
                ]);
            }
            if (!$this->claims->claimActorMatches($item, $actor)) {
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }

            $this->publication->lockForWrite($kind, $id, $item['submission_id']);
            $before = $this->detailSnapshot($kind, $item);
            $beforeAudit = $this->detailAuditSnapshot($before);
            $beforeInputAudit = $this->inputAuditSnapshot($before);
            $this->clearInvalidAccessPath($item, $attemptDetails);
            SubmissionItemDetailsInput::mergeCorrections($item, $attemptDetails);
            $this->items->updateDetails($kind, $id, $attemptDetails, $now);
            $updated = $this->itemProjection->reread($kind, $id, $item['submission_id']);
            $after = $this->detailSnapshot($kind, $updated);
            $afterAudit = $this->detailAuditSnapshot($after);
            $afterInputAudit = $this->inputAuditSnapshot($after);
            if ($before !== $after) {
                $class = ItemChangeClass::classify($this->changedFields($before, $after));
                $this->publication->recordChange($kind, $id, $item['submission_id'], $class);
                if ($class === ItemChangeClass::IDENTITY) {
                    $this->supersedeOpenRun($kind, $id, $now);
                }
            }
            if ($beforeAudit !== $afterAudit) {
                $this->events->record(
                    $item['submission_id'], $id, $actor, 'item_details_updated', null,
                    $beforeAudit, $afterAudit, $kind
                );
            }
            if ($beforeInputAudit !== $afterInputAudit) {
                $this->events->record(
                    $item['submission_id'], $id, $actor, 'item_inputs_updated', null,
                    $beforeInputAudit, $afterInputAudit, $kind
                );
            }

            return $this->result(200, [
                'item' => [
                    'kind' => $kind,
                    'id' => (int)$id,
                    'public_note' => $after['public_note'],
                    'assigned_pages' => $after['assigned_pages'],
                    'effective_material_type_id' => $after['material_type_id'],
                    'destination_class_choice' => $updated['destination_class_choice'] ?? null,
                    'access_path' => $after['access_path'],
                ],
            ]);
        });
    }

    private function clearInvalidAccessPath(array $item, array &$details)
    {
        if (!array_key_exists('staff_material_type_id', $details) || empty($item['access_path'])) {
            return;
        }
        $prospective = array_merge($item, $details);
        $typeId = EffectiveMaterialType::id($prospective);
        $type = $this->itemProjection->materialType($typeId);
        $prospective['material_type'] = $type['name'] ?? null;
        if (!in_array($item['access_path'], AccessPathPolicy::allowedForItem($prospective), true)) {
            $details['access_path'] = null;
        }
    }

    private function supersedeOpenRun($kind, $id, $now)
    {
        $run = $this->flows->openRun($kind, $id, true);
        if ($run) {
            $this->flows->updateRun($run['id'], [
                'current_step_key' => null,
                'finish_state' => 'superseded',
                'closed_at' => $now,
                'closed_reason' => 'draft_inputs_changed',
            ]);
        }
    }

    private function detailSnapshot($kind, array $item)
    {
        $projection = $this->inputProjection->project(
            $kind, $item, $item['material_type'] ?? null
        );
        return [
            'inputs' => $projection['inputs'],
            'material_type_id' => $projection['effective_material_type']['id'],
            'material_type_key' => $projection['effective_material_type']['key'],
            'destination_class' => $projection['destination_class'],
            'public_note' => $projection['inputs']['public_note'],
            'assigned_pages' => $projection['inputs']['assigned_pages'],
            'access_path' => $item['access_path'] ?? null,
        ];
    }

    private function changedFields(array $before, array $after)
    {
        $fields = [];
        foreach ($before['inputs'] as $field => $value) {
            if ($value !== $after['inputs'][$field]) {
                $fields[] = $field;
            }
        }
        foreach (['material_type_id', 'material_type_key', 'destination_class', 'access_path'] as $field) {
            if ($before[$field] !== $after[$field]) {
                $fields[] = $field;
            }
        }
        return $fields;
    }

    private function detailAuditSnapshot(array $snapshot)
    {
        return [
            'public_note' => $snapshot['public_note'],
            'assigned_pages' => $snapshot['assigned_pages'],
        ];
    }

    private function inputAuditSnapshot(array $snapshot)
    {
        $inputs = $snapshot['inputs'];
        unset($inputs['public_note'], $inputs['assigned_pages']);
        return [
            'inputs' => $inputs,
            'material_type_id' => $snapshot['material_type_id'],
            'material_type_key' => $snapshot['material_type_key'],
            'destination_class' => $snapshot['destination_class'],
            'access_path' => $snapshot['access_path'],
        ];
    }

}

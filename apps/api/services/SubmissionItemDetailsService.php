<?php

namespace app\services;

use Yii;
use app\models\MaterialTypes;

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
            $before = $this->detailSnapshot($kind, $item);
            $beforeAudit = $this->detailAuditSnapshot($before);
            $beforeInputAudit = $this->inputAuditSnapshot($before);
            $this->clearInvalidAccessPath($item, $details);
            $this->mergeCorrections($item, $details);
            $this->items->updateDetails($kind, $id, $details, $now);
            $updated = $this->items->find($kind, $id);
            $after = $this->detailSnapshot($kind, $updated);
            $afterAudit = $this->detailAuditSnapshot($after);
            $afterInputAudit = $this->inputAuditSnapshot($after);
            if ($before !== $after) {
                $this->publication->invalidateDraft($kind, $id, $item['submission_id']);
                $this->supersedeOpenRun($kind, $id, $now);
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
        if (array_key_exists('effective_material_type_id', $payload)) {
            $value = $payload['effective_material_type_id'];
            if ($value === null || $value === '') {
                $details['staff_material_type_id'] = null;
            } elseif ((is_int($value) || (is_string($value) && ctype_digit($value))) && (int)$value > 0
                && MaterialTypes::findOne((int)$value)) {
                $details['staff_material_type_id'] = (int)$value;
            } else {
                return ['error_code' => 'invalid_item_detail', 'field' => 'effective_material_type_id'];
            }
        }
        if (array_key_exists('destination_class_choice', $payload)) {
            $value = $payload['destination_class_choice'];
            if ($value === null || $value === '') {
                $details['destination_class_choice'] = null;
            } elseif (is_string($value) && in_array($value, ['electronic', 'print'], true)) {
                $details['destination_class_choice'] = $value;
            } else {
                return ['error_code' => 'invalid_item_detail', 'field' => 'destination_class_choice'];
            }
        }
        if (array_key_exists('corrections', $payload)) {
            if (!is_array($payload['corrections'])) {
                return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
            }
            $corrections = [];
            $allowed = array_keys(SubmissionInputProjection::RESOURCE_DATA_FIELDS);
            foreach ($payload['corrections'] as $field => $value) {
                if (!in_array($field, $allowed, true)) {
                    return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
                }
                $normalized = $this->normalizeCorrection($field, $value);
                if (is_array($normalized) && isset($normalized['error_code'])) {
                    return $normalized;
                }
                $corrections[$field] = $normalized;
            }
            $details['staff_corrections_json'] = json_encode($this->sortKeys($corrections), JSON_UNESCAPED_SLASHES);
        }
        return $details;
    }

    private function normalizeCorrection($field, $value)
    {
        if ($value === null) {
            return null;
        }
        if ($field === 'use_proxy') {
            if (in_array($value, [true, 1, '1'], true)) {
                return 1;
            }
            if (in_array($value, [false, 0, '0'], true)) {
                return 0;
            }
            return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
        }
        if ($field === 'authors' && is_array($value)) {
            foreach ($value as $author) {
                if ($author !== null && !is_scalar($author)) {
                    return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
                }
            }
            return array_map(function ($author) {
                return is_string($author) ? trim($author) : $author;
            }, $value);
        }
        if (!is_scalar($value)) {
            return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
        }
        $value = trim((string)$value);
        return $value === '' ? null : $value;
    }

    private function mergeCorrections(array $item, array &$details)
    {
        if (!array_key_exists('staff_corrections_json', $details)) {
            return;
        }
        $current = $this->decodeMap($item['staff_corrections_json'] ?? null);
        $submitted = $this->decodeMap($details['staff_corrections_json']);
        $details['staff_corrections_json'] = json_encode(
            $this->sortKeys(array_merge($current, $submitted)), JSON_UNESCAPED_SLASHES
        );
    }

    private function clearInvalidAccessPath(array $item, array &$details)
    {
        if (!array_key_exists('staff_material_type_id', $details) || empty($item['access_path'])) {
            return;
        }
        $prospective = array_merge($item, $details);
        $typeId = EffectiveMaterialType::id($prospective);
        $type = $typeId ? MaterialTypes::findOne($typeId) : null;
        $prospective['material_type'] = $type ? $type->name : null;
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

    private function decodeMap($value)
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return is_array($value) ? $value : [];
    }

    private function sortKeys(array $value)
    {
        foreach ($value as &$child) {
            if (is_array($child)) {
                $child = $this->sortKeys($child);
            }
        }
        unset($child);
        if (array_keys($value) !== range(0, count($value) - 1)) {
            ksort($value);
        }
        return $value;
    }
}

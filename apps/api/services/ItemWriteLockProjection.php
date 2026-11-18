<?php

namespace app\services;

use Yii;

/** Enriches an acquired item without replacing its raw locking-read models. */
class ItemWriteLockProjection
{
    public function project(array $locked)
    {
        if ($locked['missing'] !== null) {
            return null;
        }
        $transaction = Yii::$app->db->getTransaction();
        if ($transaction === null || !$transaction->isActive) {
            throw new \LogicException('ItemWriteLockProjection requires an active transaction.');
        }

        $kind = $locked['kind'];
        $item = $locked['item']->getAttributes();
        $submission = $locked['submission']->getAttributes();
        $run = Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = :kind AND item_id = :id '
            . 'ORDER BY id DESC LIMIT 1 FOR UPDATE',
            [':kind' => $kind, ':id' => (int)$item['id']]
        )->queryOne() ?: null;
        $version = $run ? Yii::$app->db->createCommand(
            'SELECT * FROM flow_versions WHERE flow_id = :flow_id AND version = :version LOCK IN SHARE MODE',
            [':flow_id' => (int)$run['flow_id'], ':version' => (int)$run['version']]
        )->queryOne() : null;

        $sourceId = SourceResourceId::canonical($item['source_resource_id'] ?? null);
        $source = null;
        if ($sourceId !== null) {
            $source = Yii::$app->db->createCommand(
                'SELECT * FROM resources WHERE resource_id = :id LOCK IN SHARE MODE',
                [':id' => $sourceId]
            )->queryOne() ?: null;
        }
        $sourceTypeId = $source['material_type_id'] ?? null;
        $materialTypeId = EffectiveMaterialType::id([
            'staff_material_type_id' => $item['staff_material_type_id'] ?? null,
            'default_material_type_id' => $item['material_type_id'] ?? null,
            'source_material_type_id' => $sourceTypeId,
        ]);
        $materialType = null;
        if ($materialTypeId !== null) {
            $materialType = Yii::$app->db->createCommand(
                'SELECT * FROM material_types WHERE material_type_id = :id LOCK IN SHARE MODE',
                [':id' => $materialTypeId]
            )->queryOne() ?: null;
        }
        $claimedBy = $item['claimed_by'] ?? null;
        $claimedByDisplay = $claimedBy === null ? null : Yii::$app->db->createCommand(
            'SELECT COALESCE(NULLIF(full_name, ""), username) FROM users WHERE username = :username LIMIT 1',
            [':username' => $claimedBy]
        )->queryScalar();
        $groupId = $item['assigned_group_id'] ?? null;
        $groupName = $groupId === null ? null : Yii::$app->db->createCommand(
            'SELECT name FROM staff_groups WHERE id = :id LIMIT 1',
            [':id' => $groupId]
        )->queryScalar();

        return [
            'id' => $item['id'],
            'submission_id' => $item['submission_id'],
            'materialized_physical_reference_id' => $item['materialized_physical_reference_id'] ?? null,
            'offering_id' => $submission['offering_id'] ?? null,
            'claimed_by' => $claimedBy,
            'claimed_at' => $item['claimed_at'] ?? null,
            'last_activity_at' => $item['last_activity_at'] ?? null,
            'assigned_group_id' => $groupId,
            'access_path' => $item['access_path'] ?? null,
            'status' => $item['item_status'] ?? null,
            'position' => $item['display_order'] ?? null,
            'public_note' => $item['public_note'] ?? null,
            'assigned_pages' => $item['assigned_pages'] ?? null,
            'resource_data' => $kind === 'new' ? ($item['resource_data'] ?? null) : null,
            'source_resource_title' => $source['name'] ?? null,
            'source_resource_found' => $source['resource_id'] ?? null,
            'source_material_type_id' => $sourceTypeId,
            'source_resource_id' => $item['source_resource_id'] ?? null,
            'source_folio_instance_id' => $item['source_folio_instance_id'] ?? null,
            'source_folio_holdings_id' => $item['source_folio_holdings_id'] ?? null,
            'source_snapshot_json' => $item['source_snapshot_json'] ?? null,
            'staff_corrections_json' => $item['staff_corrections_json'] ?? null,
            'staff_material_type_id' => $item['staff_material_type_id'] ?? null,
            'destination_class_choice' => $item['destination_class_choice'] ?? null,
            'default_material_type_id' => $item['material_type_id'] ?? null,
            'material_type_id' => $materialTypeId,
            'effective_material_type_id' => $materialTypeId,
            'material_type' => $materialType['name'] ?? null,
            'current_step_key' => $run['current_step_key'] ?? null,
            'flow_finish_state' => $run['finish_state'] ?? null,
            'flow_steps_json' => $version['steps_json'] ?? null,
            'submission_uuid' => $submission['submission_uuid'] ?? null,
            'course_code' => $submission['course_code'] ?? null,
            'section' => $submission['section'] ?? null,
            'term_code' => $submission['term_code'] ?? null,
            'link_state' => $submission['link_state'] ?? null,
            'submission_status' => $submission['status'] ?? null,
            'submitted_at' => $submission['submitted_at'] ?? null,
            'claimed_by_display' => $claimedByDisplay,
            'assigned_group_name' => $groupName,
            'item_kind' => $kind,
        ];
    }
}

<?php

namespace app\services;

use yii\db\Connection;

/** Captures verified live destinations without changing materialization markers or course content. */
class SubmissionPublicationStateMigrationReconciler
{
    private $db;
    private $policy;

    public function __construct(Connection $db)
    {
        $this->db = $db;
        $this->policy = new PublicationPolicy();
    }

    public function reconcile()
    {
        foreach ([
            'new' => 'submission_new_resources',
            'reuse' => 'submission_reuse_resources',
        ] as $kind => $table) {
            $rows = $this->db->createCommand(
                'SELECT item.*, submission.offering_id, '
                . ($kind === 'reuse' ? 'source.material_type_id' : 'item.material_type_id') . ' AS current_material_type_id '
                . 'FROM ' . $table . ' item INNER JOIN faculty_submissions submission '
                . 'ON submission.submission_id = item.submission_id '
                . ($kind === 'reuse' ? 'LEFT JOIN resources source ON source.resource_id = item.source_resource_id ' : '')
                . 'ORDER BY item.id'
            )->queryAll();
            foreach ($rows as $item) {
                $this->reconcileItem($kind, $item);
            }
        }
    }

    private function reconcileItem($kind, array $item)
    {
        $result = $this->destination($kind, $item);
        $run = $this->latestRun($kind, $item['id']);
        $flowReady = PublicationPolicy::isReadyRun($run) && (int)$run['draft_revision'] === 1;
        $values = [
            'item_kind' => $kind,
            'item_id' => (int)$item['id'],
            'submission_id' => (int)$item['submission_id'],
            'state' => $flowReady ? 'ready' : 'pending',
            'draft_revision' => 1,
            'published_revision' => null,
            'pending_changes' => 'none',
            'readiness_source' => null,
            'readiness_reason' => null,
            'readiness_run_id' => null,
            'readiness_revision' => null,
            'readiness_context_json' => null,
            'published_by_staff_id' => null,
            'published_at' => null,
            'published_destination_json' => null,
            'published_snapshot' => null,
            'reconciliation_status' => $result['status'],
            'reconciliation_reason' => $result['reason'],
        ];

        if ($result['verified']) {
            $values['published_revision'] = 1;
            $values['pending_changes'] = 'unknown';
            $values['published_by_staff_id'] = $item['materialized_by_staff_id'] ?: null;
            $values['published_at'] = $item['materialized_at'] ?: null;
            $values['published_destination_json'] = json_encode($result['destination'], JSON_UNESCAPED_SLASHES);
            $values['published_snapshot'] = json_encode($result['snapshot'], JSON_UNESCAPED_SLASHES);
            $values['reconciliation_reason'] = 'Live destination captured; equality with the pre-version draft is unknown.';
            $values['state'] = $flowReady ? 'ready' : 'published';
        }
        if ($flowReady) {
            $values['readiness_source'] = 'flow';
            $values['readiness_reason'] = $run['finish_reason'] ?: null;
            $values['readiness_run_id'] = (int)$run['id'];
            $values['readiness_revision'] = 1;
            $contextItem = [
                'material_type_id' => $item['current_material_type_id'],
                'access_path' => $item['access_path'] ?? null,
            ];
            $values['readiness_context_json'] = json_encode(
                $this->policy->context($contextItem, $run), JSON_UNESCAPED_SLASHES
            );
        }
        $this->db->createCommand()->upsert('submission_publication_state', $values, $values)->execute();
    }

    private function destination($kind, array $item)
    {
        $resourceId = $item['materialized_resource_id'] ?? null;
        $courseResourceId = $item['materialized_course_resource_id'] ?? null;
        $physicalId = $item['materialized_physical_reference_id'] ?? null;
        if ($physicalId && ($resourceId || $courseResourceId)) {
            return $this->unknown('conflicting_markers', 'Both physical and electronic destination markers are set.');
        }
        if ($physicalId) {
            return $this->physicalDestination($kind, $item, $physicalId);
        }
        if ($resourceId || $courseResourceId) {
            return $this->electronicDestination($kind, $item, $resourceId, $courseResourceId);
        }
        $hasMarker = !empty($item['materialized_at']) || !empty($item['materialized_by_staff_id'])
            || !empty($item['materialized_folder_id']);
        return $hasMarker
            ? $this->unknown('marker_only', 'Materialization metadata has no verifiable live destination id.')
            : $this->unknown('no_materialization_marker', 'No destination marker exists; item_status is not publication evidence.');
    }

    private function physicalDestination($kind, array $item, $referenceId)
    {
        $reference = $this->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id LIMIT 1',
            [':id' => (int)$referenceId]
        )->queryOne();
        if (!$reference) {
            return $this->unknown('missing_destination', 'The marked physical reference does not exist.');
        }
        if (empty($item['offering_id']) || (int)$reference['offering_id'] !== (int)$item['offering_id']) {
            return $this->unknown('offering_mismatch', 'The physical reference belongs to a different or missing offering.');
        }
        $expectedId = $kind === 'reuse'
            ? ($item['barcode'] ?? null)
            : (($item['source_barcode'] ?? null) ?: ($item['source_folio_instance_id'] ?? null));
        if ($expectedId && (string)$expectedId !== (string)$reference['external_resource_id']) {
            return $this->unknown('identity_mismatch', 'The physical reference does not match the item barcode or instance id.');
        }
        $shared = $this->sharedPhysicalReference($reference);
        return [
            'verified' => true,
            'status' => $shared ? 'verified_shared' : 'verified',
            'reason' => $shared ? 'The physical resource is also associated with another course offering.' : null,
            'destination' => [
                'kind' => 'physical',
                'physical_reference_id' => (int)$reference['reference_id'],
                'offering_id' => (int)$reference['offering_id'],
                'external_resource_id' => $reference['external_resource_id'],
                'shared' => $shared,
            ],
            'snapshot' => [
                'kind' => 'physical',
                'reference' => $reference,
            ],
        ];
    }

    private function electronicDestination($kind, array $item, $resourceId, $courseResourceId)
    {
        if (!$resourceId || !$courseResourceId) {
            return $this->unknown('marker_only', 'Electronic publication requires both resource and course-resource markers.');
        }
        $courseResource = $this->db->createCommand(
            'SELECT * FROM course_resources WHERE course_resource_id = :id LIMIT 1',
            [':id' => (int)$courseResourceId]
        )->queryOne();
        if (!$courseResource) {
            return $this->unknown('missing_destination', 'The marked course resource does not exist.');
        }
        if (empty($item['offering_id']) || (int)$courseResource['offering_id'] !== (int)$item['offering_id']) {
            return $this->unknown('offering_mismatch', 'The course resource belongs to a different or missing offering.');
        }
        if ((int)$courseResource['resource_id'] !== (int)$resourceId) {
            return $this->unknown('stale_marker', 'The course-resource marker points at a different resource.');
        }
        $resource = $this->db->createCommand(
            'SELECT * FROM resources WHERE resource_id = :id LIMIT 1', [':id' => (int)$resourceId]
        )->queryOne();
        if (!$resource) {
            return $this->unknown('missing_resource', 'The marked live resource no longer exists.');
        }
        $links = $this->db->createCommand(
            'SELECT * FROM resource_links WHERE resource_id = :id ORDER BY link_id', [':id' => (int)$resourceId]
        )->queryAll();
        $metadata = $this->db->createCommand(
            'SELECT field_name, field_value FROM resource_metadata WHERE resource_id = :id ORDER BY metadata_id',
            [':id' => (int)$resourceId]
        )->queryAll();
        $shared = $this->sharedElectronicResource($resourceId, $item['offering_id']);
        return [
            'verified' => true,
            'status' => $shared ? 'verified_shared' : 'verified',
            'reason' => $shared ? 'The resource is also associated with another course offering.' : null,
            'destination' => [
                'kind' => 'electronic',
                'resource_id' => (int)$resourceId,
                'course_resource_id' => (int)$courseResourceId,
                'offering_id' => (int)$courseResource['offering_id'],
                'shared' => $shared,
            ],
            'snapshot' => [
                'kind' => 'electronic',
                'resource' => $resource,
                'course_resource' => $courseResource,
                'links' => $links,
                'metadata' => $metadata,
            ],
        ];
    }

    private function latestRun($kind, $itemId)
    {
        return $this->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = :kind AND item_id = :item_id '
            . 'ORDER BY id DESC LIMIT 1',
            [':kind' => $kind, ':item_id' => (int)$itemId]
        )->queryOne() ?: null;
    }

    private function sharedPhysicalReference(array $reference)
    {
        return (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references '
            . 'WHERE external_resource_id = :external_resource_id AND offering_id <> :offering_id',
            [
                ':external_resource_id' => $reference['external_resource_id'],
                ':offering_id' => (int)$reference['offering_id'],
            ]
        )->queryScalar() > 0;
    }

    private function sharedElectronicResource($resourceId, $offeringId)
    {
        return (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM course_resources WHERE resource_id = :resource_id AND offering_id <> :offering_id',
            [
                ':resource_id' => (int)$resourceId,
                ':offering_id' => (int)$offeringId,
            ]
        )->queryScalar() > 0;
    }

    private function unknown($status, $reason)
    {
        return ['verified' => false, 'status' => $status, 'reason' => $reason];
    }
}

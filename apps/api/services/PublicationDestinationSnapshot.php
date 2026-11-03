<?php

namespace app\services;

use Yii;

/** Builds live-content snapshots and enumerates their lock dependencies. */
class PublicationDestinationSnapshot
{
    private $db;
    private $identity;

    public function __construct($db = null, ?PhysicalResourceReferenceIdentity $identity = null)
    {
        $this->db = $db ?: Yii::$app->db;
        $this->identity = $identity ?: new PhysicalResourceReferenceIdentity();
    }

    public function electronic($courseResourceId, $forUpdate = false, ?callable $guard = null)
    {
        $suffix = $forUpdate ? ' FOR UPDATE' : '';
        $this->guard($guard, 'course_resource_ids', $courseResourceId);
        $courseResource = $this->db->createCommand(
            'SELECT course_resource_id, offering_id, resource_id, `order`, start_visibility, end_visibility, '
            . 'use_resource_visibility, primary_link_start_visibility, primary_link_end_visibility, '
            . 'use_primary_link_visibility, folder_id FROM course_resources WHERE course_resource_id = :id' . $suffix,
            [':id' => (int)$courseResourceId]
        )->queryOne();
        if (!$courseResource) {
            return null;
        }
        $this->guard($guard, 'offering_ids', $courseResource['offering_id']);
        $this->guard($guard, 'resource_ids', $courseResource['resource_id']);

        $resource = $this->db->createCommand(
            'SELECT resource_id, legacy_resource_id, name, item_url, use_proxy, folder_id, description, '
            . 'external_note, institution, material_type_id, created_at FROM resources WHERE resource_id = :id' . $suffix,
            [':id' => (int)$courseResource['resource_id']]
        )->queryOne();
        if (!$resource) {
            return null;
        }

        $folderId = $courseResource['folder_id'] ?: $resource['folder_id'];
        $folderName = null;
        if ($folderId !== null) {
            $this->guard($guard, 'folder_ids', $folderId);
            $folder = $this->db->createCommand(
                'SELECT folder_id, name FROM folders WHERE folder_id = :id' . $suffix,
                [':id' => (int)$folderId]
            )->queryOne();
            $folderName = $folder['name'] ?? null;
        }

        $metadata = $this->db->createCommand(
            'SELECT metadata_id, resource_id, field_name, field_value, created_at FROM resource_metadata '
            . 'WHERE resource_id = :id ORDER BY metadata_id' . $suffix,
            [':id' => (int)$resource['resource_id']]
        )->queryAll();
        $metadataIds = array_column($metadata, 'metadata_id');
        foreach ($metadataIds as $id) {
            $this->guard($guard, 'resource_metadata_ids', $id);
        }
        $links = $this->db->createCommand(
            'SELECT link_id, resource_id, url, title, description, use_proxy, `order`, created_at, '
            . 'start_visibility, end_visibility, use_link_visibility FROM resource_links '
            . 'WHERE resource_id = :id ORDER BY link_id' . $suffix,
            [':id' => (int)$resource['resource_id']]
        )->queryAll();
        $linkIds = array_column($links, 'link_id');
        foreach ($linkIds as $id) {
            $this->guard($guard, 'resource_link_ids', $id);
        }

        $row = array_merge($resource, $courseResource, [
            'folder_id' => $folderId,
            'folder_name' => $folderName,
        ]);
        $row['metadata'] = $metadata;
        $row['links'] = $links;
        $snapshot = PublicResourceFields::serialize($row, null);
        $snapshot['destination_kind'] = 'electronic';
        $snapshot['offering_id'] = (int)$row['offering_id'];
        $snapshot['course_resource_id'] = (int)$row['course_resource_id'];
        $snapshot['resource_id'] = (int)$row['resource_id'];
        return [
            'row' => $row,
            'snapshot' => $snapshot,
            'dependencies' => [
                'resource_metadata_ids' => array_map('intval', $metadataIds),
                'resource_link_ids' => array_map('intval', $linkIds),
                'folder_ids' => $folderId === null ? [] : [(int)$folderId],
            ],
        ];
    }

    public function physical($referenceId, $forUpdate = false, ?callable $guard = null)
    {
        $this->guard($guard, 'physical_reference_ids', $referenceId);
        $reference = $this->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id'
            . ($forUpdate ? ' FOR UPDATE' : ''), [':id' => (int)$referenceId]
        )->queryOne();
        if (!$reference) {
            return null;
        }
        $this->guard($guard, 'offering_ids', $reference['offering_id']);
        $ambiguityIds = $this->physicalCandidateIds($reference, $forUpdate, $guard);

        $snapshot = [
            'reference_id' => $reference['reference_id'],
            'external_resource_id' => $reference['external_resource_id'],
            'resource_type' => $reference['resource_type'],
            'display_name' => $reference['display_name'],
            'offering_id' => (int)$reference['offering_id'],
            'folder_id' => $reference['folder_id'],
            'order' => $reference['order'],
            'created_at' => $reference['created_at'],
            'updated_at' => $reference['updated_at'],
            'public_note' => $reference['public_note'],
            'assigned_pages' => $reference['assigned_pages'],
            'external_id' => $reference['external_resource_id'],
            'destination_kind' => 'physical',
            'physical_reference_id' => (int)$reference['reference_id'],
        ];
        if ($reference['identity_status'] === 'verified' && trim((string)$reference['folio_instance_id']) !== '') {
            $snapshot['folio_instance_id'] = $reference['folio_instance_id'];
        }
        return [
            'row' => $reference,
            'snapshot' => $snapshot,
            'ambiguity_ids' => $ambiguityIds,
            'dependencies' => ['physical_reference_ids' => $ambiguityIds],
        ];
    }

    /** Returns a conflict code for an ineligible physical row, or null when it qualifies. */
    public function physicalError($kind, array $item, array $reference)
    {
        $error = $this->physicalIdentityError($kind, $item, $reference);
        return $error !== null ? $error : $this->physicalAmbiguityError($reference);
    }

    public function physicalIdentityError($kind, array $item, array $reference)
    {
        if ($reference['identity_status'] !== 'verified' || trim((string)$reference['folio_instance_id']) === '') {
            return 'destination_unresolved';
        }
        $identity = $this->identity->resolve($kind, $item);
        if ($identity['identity_status'] !== 'verified'
            || strcasecmp($identity['folio_instance_id'], $reference['folio_instance_id']) !== 0) {
            return 'destination_unresolved';
        }
        return null;
    }

    public function physicalDestinationError(array $reference)
    {
        if ($reference['identity_status'] !== 'verified' || trim((string)$reference['folio_instance_id']) === '') {
            return 'destination_unresolved';
        }
        return $this->physicalAmbiguityError($reference);
    }

    private function physicalAmbiguityError(array $reference)
    {
        return count($this->physicalCandidateIds($reference)) > 1 ? 'destination_ambiguous' : null;
    }

    private function physicalCandidateIds(array $reference, $forUpdate = false, ?callable $guard = null)
    {
        if ($reference['identity_status'] !== 'verified' || trim((string)$reference['folio_instance_id']) === '') {
            return [];
        }
        $ids = $this->db->createCommand(
            'SELECT reference_id FROM physical_resource_references WHERE offering_id = :offering '
            . 'AND identity_status = "verified" AND LOWER(folio_instance_id) = LOWER(:instance) '
            . 'ORDER BY reference_id' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':offering' => $reference['offering_id'], ':instance' => $reference['folio_instance_id']]
        )->queryColumn();
        $ids = array_map('intval', $ids);
        foreach ($ids as $id) {
            $this->guard($guard, 'physical_reference_ids', $id);
        }
        return $ids;
    }

    private function guard(?callable $guard, $bucket, $id)
    {
        if ($guard !== null) {
            call_user_func($guard, $bucket, $id);
        }
    }
}

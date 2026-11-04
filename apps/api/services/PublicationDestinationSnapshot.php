<?php

namespace app\services;

use Yii;

/**
 * Builds the public, live-content snapshot stored on destination attachments.
 *
 * With $locking, the entry row is read FOR UPDATE and the shared content it reads (resource, folder, metadata,
 * links) LOCK IN SHARE MODE, so the snapshot is current even inside a caller whose read view is older.
 */
class PublicationDestinationSnapshot
{
    private $db;
    private $identity;

    public function __construct($db = null, ?PhysicalResourceReferenceIdentity $identity = null)
    {
        $this->db = $db ?: Yii::$app->db;
        $this->identity = $identity ?: new PhysicalResourceReferenceIdentity();
    }

    public function electronic($courseResourceId, $locking = false)
    {
        $update = $locking ? ' FOR UPDATE' : '';
        $share = $locking ? ' LOCK IN SHARE MODE' : '';
        $courseResource = $this->db->createCommand(
            'SELECT course_resource_id, offering_id, resource_id, `order`, start_visibility, end_visibility, '
            . 'use_resource_visibility, primary_link_start_visibility, primary_link_end_visibility, '
            . 'use_primary_link_visibility, folder_id FROM course_resources WHERE course_resource_id = :id' . $update,
            [':id' => (int)$courseResourceId]
        )->queryOne();
        if (!$courseResource) {
            return null;
        }
        $resource = $this->db->createCommand(
            'SELECT resource_id, legacy_resource_id, name, item_url, use_proxy, folder_id, description, '
            . 'external_note, institution, material_type_id, created_at FROM resources WHERE resource_id = :id' . $share,
            [':id' => (int)$courseResource['resource_id']]
        )->queryOne();
        if (!$resource) {
            return null;
        }

        $folderId = $courseResource['folder_id'] ?: $resource['folder_id'];
        $folderName = $folderId === null ? null : $this->db->createCommand(
            'SELECT name FROM folders WHERE folder_id = :id' . $share,
            [':id' => (int)$folderId]
        )->queryScalar();
        $row = array_merge($resource, $courseResource, [
            'folder_id' => $folderId,
            'folder_name' => $folderName === false ? null : $folderName,
        ]);
        $row['metadata'] = $this->db->createCommand(
            'SELECT metadata_id, resource_id, field_name, field_value, created_at FROM resource_metadata '
            . 'WHERE resource_id = :id ORDER BY metadata_id' . $share,
            [':id' => (int)$resource['resource_id']]
        )->queryAll();
        $row['links'] = $this->db->createCommand(
            'SELECT link_id, resource_id, url, title, description, use_proxy, `order`, created_at, '
            . 'start_visibility, end_visibility, use_link_visibility FROM resource_links '
            . 'WHERE resource_id = :id ORDER BY link_id' . $share,
            [':id' => (int)$resource['resource_id']]
        )->queryAll();

        $snapshot = PublicResourceFields::serialize($row, null);
        $snapshot['destination_kind'] = 'electronic';
        $snapshot['offering_id'] = (int)$row['offering_id'];
        $snapshot['course_resource_id'] = (int)$row['course_resource_id'];
        $snapshot['resource_id'] = (int)$row['resource_id'];
        return ['row' => $row, 'snapshot' => $snapshot];
    }

    public function physical($referenceId, $locking = false)
    {
        $reference = $this->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id' . ($locking ? ' FOR UPDATE' : ''),
            [':id' => (int)$referenceId]
        )->queryOne();
        if (!$reference) {
            return null;
        }

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
        if ($this->verified($reference)) {
            $snapshot['folio_instance_id'] = $reference['folio_instance_id'];
        }
        return [
            'row' => $reference,
            'snapshot' => $snapshot,
            'ambiguity_ids' => $this->physicalCandidateIds($reference, $locking),
        ];
    }

    /** Returns a conflict code for an ineligible physical row, or null when it qualifies. */
    public function physicalError($kind, array $item, array $reference)
    {
        return $this->physicalIdentityError($kind, $item, $reference)
            ?? $this->physicalDestinationError($reference, $this->physicalCandidateIds($reference));
    }

    public function physicalIdentityError($kind, array $item, array $reference)
    {
        if (!$this->verified($reference)) {
            return 'destination_unresolved';
        }
        $identity = $this->identity->resolve($kind, $item);
        if ($identity['identity_status'] !== 'verified'
            || strcasecmp($identity['folio_instance_id'], $reference['folio_instance_id']) !== 0) {
            return 'destination_unresolved';
        }
        return null;
    }

    /** $candidateIds are the verified references in the offering that share the reference's FOLIO instance. */
    public function physicalDestinationError(array $reference, array $candidateIds)
    {
        if (!$this->verified($reference)) {
            return 'destination_unresolved';
        }
        return count($candidateIds) > 1 ? 'destination_ambiguous' : null;
    }

    private function verified(array $reference)
    {
        return $reference['identity_status'] === 'verified' && trim((string)$reference['folio_instance_id']) !== '';
    }

    private function physicalCandidateIds(array $reference, $locking = false)
    {
        if (!$this->verified($reference)) {
            return [];
        }
        return array_map('intval', $this->db->createCommand(
            'SELECT reference_id FROM physical_resource_references WHERE offering_id = :offering '
            . 'AND identity_status = "verified" AND LOWER(folio_instance_id) = LOWER(:instance) '
            . 'ORDER BY reference_id' . ($locking ? ' FOR UPDATE' : ''),
            [':offering' => $reference['offering_id'], ':instance' => $reference['folio_instance_id']]
        )->queryColumn());
    }
}

<?php

namespace app\services;

use Yii;

/** Builds the public, live-content snapshot stored on destination attachments. */
class PublicationDestinationSnapshot
{
    private $db;
    private $identity;

    public function __construct($db = null, ?PhysicalResourceReferenceIdentity $identity = null)
    {
        $this->db = $db ?: Yii::$app->db;
        $this->identity = $identity ?: new PhysicalResourceReferenceIdentity();
    }

    public function electronic($courseResourceId)
    {
        $row = $this->db->createCommand(
            'SELECT cr.course_resource_id, cr.offering_id, cr.resource_id, cr.`order`, '
            . 'cr.start_visibility, cr.end_visibility, cr.use_resource_visibility, '
            . 'cr.primary_link_start_visibility, cr.primary_link_end_visibility, cr.use_primary_link_visibility, '
            . 'resource.legacy_resource_id, resource.name, resource.item_url, resource.use_proxy, '
            . 'COALESCE(cr.folder_id, resource.folder_id) AS folder_id, folder.name AS folder_name, '
            . 'resource.description, resource.external_note, '
            . 'resource.institution, resource.material_type_id, resource.created_at '
            . 'FROM course_resources cr INNER JOIN resources resource ON resource.resource_id = cr.resource_id '
            . 'LEFT JOIN folders folder ON folder.folder_id = COALESCE(cr.folder_id, resource.folder_id) '
            . 'WHERE cr.course_resource_id = :id',
            [':id' => (int)$courseResourceId]
        )->queryOne();
        if (!$row) {
            return null;
        }

        $resource = $row;
        $resource['metadata'] = $this->db->createCommand(
            'SELECT metadata_id, resource_id, field_name, field_value, created_at FROM resource_metadata '
            . 'WHERE resource_id = :id ORDER BY metadata_id', [':id' => $row['resource_id']]
        )->queryAll();
        $resource['links'] = $this->db->createCommand(
            'SELECT link_id, resource_id, url, title, description, use_proxy, `order`, created_at, '
            . 'start_visibility, end_visibility, use_link_visibility FROM resource_links '
            . 'WHERE resource_id = :id ORDER BY link_id', [':id' => $row['resource_id']]
        )->queryAll();

        $snapshot = PublicResourceFields::serialize($resource, null);
        $snapshot['destination_kind'] = 'electronic';
        $snapshot['offering_id'] = (int)$row['offering_id'];
        $snapshot['course_resource_id'] = (int)$row['course_resource_id'];
        $snapshot['resource_id'] = (int)$row['resource_id'];
        return ['row' => $row, 'snapshot' => $snapshot];
    }

    public function physical($referenceId)
    {
        $row = $this->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id',
            [':id' => (int)$referenceId]
        )->queryOne();
        if (!$row) {
            return null;
        }

        $snapshot = [
            'reference_id' => $row['reference_id'],
            'external_resource_id' => $row['external_resource_id'],
            'resource_type' => $row['resource_type'],
            'display_name' => $row['display_name'],
            'offering_id' => (int)$row['offering_id'],
            'folder_id' => $row['folder_id'],
            'order' => $row['order'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'public_note' => $row['public_note'],
            'assigned_pages' => $row['assigned_pages'],
            'external_id' => $row['external_resource_id'],
            'destination_kind' => 'physical',
            'physical_reference_id' => (int)$row['reference_id'],
        ];
        if ($row['identity_status'] === 'verified' && trim((string)$row['folio_instance_id']) !== '') {
            $snapshot['folio_instance_id'] = $row['folio_instance_id'];
        }
        return ['row' => $row, 'snapshot' => $snapshot];
    }

    /** Returns a conflict code for an ineligible physical row, or null when it qualifies. */
    public function physicalError($kind, array $item, array $reference)
    {
        $error = $this->physicalIdentityError($kind, $item, $reference);
        if ($error !== null) {
            return $error;
        }
        return $this->physicalAmbiguityError($reference);
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
        $duplicates = (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references WHERE offering_id = :offering '
            . 'AND identity_status = "verified" AND LOWER(folio_instance_id) = LOWER(:instance)',
            [':offering' => $reference['offering_id'], ':instance' => $reference['folio_instance_id']]
        )->queryScalar();
        return $duplicates > 1 ? 'destination_ambiguous' : null;
    }
}

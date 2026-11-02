<?php

require_once __DIR__ . '/TestSubmissionFixture.php';

/** Synthetic API-116A rows with cleanup limited to the fixtures created here. */
class Api116AFixture
{
    private $prefix;
    private $submissions = [];
    private $offerings = [];
    private $courseIds = [];
    private $resourceIds = [];
    private $courseResourceIds = [];
    private $physicalReferenceIds = [];
    private $flowIds = [];
    private $autoIncrements = [];

    public function __construct($prefix = 'test-api116a-')
    {
        $this->prefix = $prefix;
        $db = \Yii::$app->db;
        foreach ([
            'courses', 'course_offerings', 'faculty_submissions', 'submission_new_resources',
            'submission_reuse_resources', 'resources', 'course_resources', 'physical_resource_references',
            'resource_metadata', 'resource_links', 'flows', 'flow_versions', 'item_flow_runs', 'workflow_events',
            'publication_destinations', 'publication_attachments',
        ] as $table) {
            if ($db->schema->getTableSchema($table, true)) {
                $value = $db->createCommand(
                    'SELECT AUTO_INCREMENT FROM information_schema.TABLES '
                    . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table',
                    [':table' => $table]
                )->queryScalar();
                $this->autoIncrements[$table] = (int)$value;
            }
        }
    }
    public function createOffering($suffix)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('courses', [
            'course_name' => $this->prefix . $suffix,
            'course_number' => $this->prefix . $suffix,
        ])->execute();
        $courseId = (int)$db->getLastInsertID();
        $this->courseIds[] = $courseId;
        $db->createCommand()->insert('course_offerings', [
            'course_id' => $courseId,
            'folio_course_id' => $this->prefix . 'folio-' . $suffix,
            'term_id' => $this->prefix . 'term-' . $suffix,
            'term_name' => 'Fall 2027',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$db->getLastInsertID();
        $this->offerings[] = $offeringId;
        return $offeringId;
    }
    public function createItem($suffix, $offeringId, $representation = 'new')
    {
        $uuid = $this->uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 116A-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
            'offering_id' => $offeringId,
        ]);
        $this->submissions[$submissionId] = $uuid;
        $db = \Yii::$app->db;

        if ($representation === 'legacy_reuse') {
            $db->createCommand()->delete('submission_new_resources', ['submission_id' => $submissionId])->execute();
            $db->createCommand()->insert('submission_reuse_resources', [
                'submission_id' => $submissionId,
                'faculty_notes' => 'Synthetic API-116A legacy reuse item draft',
                'source_snapshot_json' => json_encode(['title' => 'Synthetic API-116A legacy reuse draft']),
                'item_status' => 'pending',
            ])->execute();
            $itemId = (int)$db->getLastInsertID();
            return ['kind' => 'reuse', 'id' => $itemId, 'submission_id' => $submissionId, 'uuid' => $uuid];
        }

        $itemId = (int)$db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $db->createCommand()->update('submission_new_resources', [
            'resource_data' => json_encode(['title' => 'Synthetic API-116A ' . $suffix . ' draft']),
            'is_reuse' => $representation === 'new_table_reuse' ? 1 : 0,
        ], ['id' => $itemId])->execute();

        if ($representation === 'new_table_reuse') {
            $db->createCommand()->insert('submission_new_resources', [
                'submission_id' => $submissionId,
                'is_reuse' => 1,
                'resource_data' => json_encode(['title' => 'Synthetic API-116A new-table reuse draft']),
                'item_status' => 'pending',
            ])->execute();
            $itemId = (int)$db->getLastInsertID();
        }
        return ['kind' => 'new', 'id' => $itemId, 'submission_id' => $submissionId, 'uuid' => $uuid];
    }

    public function setMarkers(array $item, array $markers)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        \Yii::$app->db->createCommand()->update($table, $markers, ['id' => $item['id']])->execute();
    }

    public function itemRow(array $item)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        return \Yii::$app->db->createCommand(
            'SELECT * FROM ' . $table . ' WHERE id = :id', [':id' => $item['id']]
        )->queryOne();
    }

    public function createFinishedRun(array $item, $suffix)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'flow-' . $suffix,
            'description' => 'Synthetic API-116A preservation flow',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        $this->flowIds[] = $flowId;
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode([['key' => 'finish', 'kind' => 'finish', 'outcomes' => []]]),
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'flow_id' => $flowId,
            'version' => 1,
            'current_step_key' => null,
            'finish_state' => 'available_online',
            'finish_reason' => 'Synthetic preserved run reason',
            'started_at' => '2026-10-01 12:01:00',
            'closed_at' => '2026-10-01 12:02:00',
            'closed_reason' => 'Synthetic preserved run closure',
            'draft_revision' => 37,
        ])->execute();
        return (int)$db->getLastInsertID();
    }
    public function createElectronicDestination($offeringId, $suffix)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('resources', [
            'name' => $this->electronicResourceName($suffix),
            'item_url' => 'https://example.test/api116a/' . rawurlencode($suffix),
            'description' => 'Synthetic live description ' . $suffix,
            'internal_note' => 'Synthetic private note ' . $suffix,
            'external_note' => 'Synthetic public note ' . $suffix,
            'assigned_pages' => 'Synthetic live pages ' . $suffix,
            'use_proxy' => 0,
        ])->execute();
        $resourceId = (int)$db->getLastInsertID();
        $this->resourceIds[] = $resourceId;
        $db->createCommand()->insert('course_resources', [
            'offering_id' => $offeringId,
            'resource_id' => $resourceId,
            'order' => 11,
        ])->execute();
        $courseResourceId = (int)$db->getLastInsertID();
        $this->courseResourceIds[] = $courseResourceId;
        $db->createCommand()->insert('resource_metadata', [
            'resource_id' => $resourceId,
            'field_name' => 'synthetic-field',
            'field_value' => 'Synthetic public metadata ' . $suffix,
        ])->execute();
        $db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://example.test/api116a/link/' . rawurlencode($suffix),
            'title' => 'Synthetic public link ' . $suffix,
            'use_proxy' => 0,
        ])->execute();
        return [
            'destination_kind' => 'electronic',
            'offering_id' => (int)$offeringId,
            'course_resource_id' => $courseResourceId,
            'resource_id' => $resourceId,
        ];
    }

    public function electronicResourceName($suffix)
    {
        return $this->prefix . 'live ' . $suffix;
    }

    public function createPhysicalDestination($offeringId, $suffix, $instanceId, $identityStatus = 'verified')
    {
        $db = \Yii::$app->db;
        $externalId = $this->prefix . 'barcode-' . $suffix;
        $db->createCommand()->insert('physical_resource_references', [
            'external_resource_id' => $externalId,
            'folio_instance_id' => $identityStatus === 'verified' ? $instanceId : null,
            'legacy_identifier' => $externalId,
            'legacy_identifier_type' => 'barcode',
            'identity_status' => $identityStatus,
            'identity_provenance_json' => json_encode([
                'evidence_source' => 'eds_accession_parser',
                'outcome' => $identityStatus,
            ]),
            'resource_type' => 'physical',
            'display_name' => $this->prefix . 'live physical ' . $suffix,
            'public_note' => 'Synthetic physical note ' . $suffix,
            'assigned_pages' => 'Synthetic physical pages ' . $suffix,
            'offering_id' => $offeringId,
            'order' => 12,
        ])->execute();
        $id = (int)$db->getLastInsertID();
        $this->physicalReferenceIds[] = $id;
        return [
            'destination_kind' => 'physical',
            'offering_id' => (int)$offeringId,
            'physical_reference_id' => $id,
        ];
    }

    public function cleanup()
    {
        $db = \Yii::$app->db;
        Api116ARegistryFixtureCleanup::deleteForPointers($this->courseResourceIds, $this->physicalReferenceIds);
        foreach (array_keys($this->submissions) as $submissionId) {
            foreach ([
                'new' => 'submission_new_resources',
                'reuse' => 'submission_reuse_resources',
            ] as $kind => $table) {
                $ids = $db->createCommand(
                    'SELECT id FROM ' . $table . ' WHERE submission_id = :id', [':id' => $submissionId]
                )->queryColumn();
                if ($ids) {
                    $db->createCommand()->delete('item_flow_runs', [
                        'and', ['item_kind' => $kind], ['item_id' => $ids],
                    ])->execute();
                }
            }
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
            if ($db->schema->getTableSchema('submission_publication_state', true)) {
                $db->createCommand()->delete('submission_publication_state', ['submission_id' => $submissionId])->execute();
            }
            TestSubmissionFixture::deleteApi116ARowsForSubmission($submissionId);
            TestSubmissionFixture::delete($this->submissions[$submissionId]);
        }
        foreach ($this->physicalReferenceIds as $id) {
            $db->createCommand()->delete('physical_resource_references', ['reference_id' => $id])->execute();
        }
        foreach ($this->courseResourceIds as $id) {
            $db->createCommand()->delete('course_resources', ['course_resource_id' => $id])->execute();
        }
        foreach ($this->resourceIds as $id) {
            $db->createCommand()->delete('resource_links', ['resource_id' => $id])->execute();
            $db->createCommand()->delete('resource_metadata', ['resource_id' => $id])->execute();
            $db->createCommand()->delete('resources', ['resource_id' => $id])->execute();
        }
        foreach ($this->offerings as $id) {
            $db->createCommand()->delete('course_offerings', ['offering_id' => $id])->execute();
        }
        foreach ($this->courseIds as $id) {
            $db->createCommand()->delete('courses', ['course_id' => $id])->execute();
        }
        foreach ($this->flowIds as $id) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $id])->execute();
            $db->createCommand()->delete('flows', ['id' => $id])->execute();
        }
        foreach ($this->autoIncrements as $table => $value) {
            if ($value > 0 && $db->schema->getTableSchema($table, true)) {
                $db->createCommand('ALTER TABLE ' . $table . ' AUTO_INCREMENT = ' . (int)$value)->execute();
            }
        }
        $this->submissions = [];
        $this->offerings = [];
        $this->courseIds = [];
        $this->resourceIds = [];
        $this->courseResourceIds = [];
        $this->physicalReferenceIds = [];
        $this->flowIds = [];
        $this->autoIncrements = [];
    }
    public static function itemKey(array $item)
    {
        return ['kind' => $item['kind'], 'id' => (int)$item['id']];
    }

    public static function accession($instanceId)
    {
        return 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.' . str_replace('-', '.', $instanceId);
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

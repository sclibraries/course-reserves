<?php

use app\services\PhysicalResourceReferenceIdentity;
use yii\db\Migration;

class m261030_000001_add_physical_reference_identity extends Migration
{
    public function safeUp()
    {
        $this->addColumnIfMissing('folio_instance_id', $this->string(255)->null());
        $this->addColumnIfMissing('legacy_identifier', $this->string(255)->null());
        $this->addColumnIfMissing('legacy_identifier_type', $this->string(16)->null());
        $this->addColumnIfMissing('identity_status', $this->string(16)->null());
        $this->addColumnIfMissing('identity_provenance_json', 'LONGTEXT NULL');
        $this->createIndexIfMissing(
            'idx_prr_folio_instance_offering',
            'physical_resource_references',
            ['folio_instance_id', 'offering_id']
        );

        $this->backfill();
        $this->db->createCommand(
            'UPDATE physical_resource_references SET identity_status = "unverified", updated_at = updated_at '
            . 'WHERE identity_status IS NULL'
        )->execute();
        $this->alterColumn(
            'physical_resource_references',
            'identity_status',
            $this->string(16)->notNull()->defaultValue('unverified')
        );
    }

    public function safeDown()
    {
        $this->dropIndexIfExists('idx_prr_folio_instance_offering', 'physical_resource_references');
        foreach ([
            'identity_provenance_json', 'identity_status', 'legacy_identifier_type',
            'legacy_identifier', 'folio_instance_id',
        ] as $column) {
            $this->dropColumnIfExists($column);
        }
    }

    private function backfill()
    {
        $references = $this->db->createCommand(
            'SELECT reference_id, external_resource_id, offering_id, updated_at '
            . 'FROM physical_resource_references WHERE folio_instance_id IS NULL '
            . 'AND legacy_identifier IS NULL AND identity_provenance_json IS NULL'
        )->queryAll();
        if (!$references) {
            return;
        }

        $claimants = [];
        foreach ([
            'new' => ['submission_new_resources', 'resource_data', 'source_barcode'],
            'reuse' => ['submission_reuse_resources', 'source_snapshot_json', 'barcode'],
        ] as $kind => $source) {
            $rows = $this->db->createCommand(
                'SELECT item.id, item.materialized_physical_reference_id AS reference_id, '
                . 'item.' . $source[1] . ' AS evidence_json, item.source_folio_instance_id, '
                . 'item.' . $source[2] . ' AS source_barcode, submission.offering_id '
                . 'FROM ' . $source[0] . ' item INNER JOIN faculty_submissions submission '
                . 'ON submission.submission_id = item.submission_id '
                . 'WHERE item.materialized_physical_reference_id IS NOT NULL'
            )->queryAll();
            foreach ($rows as $row) {
                $row['kind'] = $kind;
                $row['resource_data'] = $kind === 'new' ? $row['evidence_json'] : null;
                $row['source_snapshot_json'] = $kind === 'reuse' ? $row['evidence_json'] : null;
                $row['source_barcode'] = $kind === 'new' ? $row['source_barcode'] : null;
                $row['barcode'] = $kind === 'reuse' ? $row['source_barcode'] : null;
                $claimants[(int)$row['reference_id']][] = $row;
            }
        }

        $identity = new PhysicalResourceReferenceIdentity();
        foreach ($references as $reference) {
            $items = $claimants[(int)$reference['reference_id']] ?? [];
            $candidate = count($items) === 1 ? $items[0] : null;
            $resolved = $candidate
                ? $identity->resolve($candidate['kind'], array_merge($candidate, ['destination_class' => 'print']))
                : null;
            $sameOffering = $candidate && (int)$candidate['offering_id'] === (int)$reference['offering_id'];
            $sameIdentifier = $resolved && $this->sameId(
                $resolved['folio_instance_id'],
                $reference['external_resource_id']
            );
            $verified = $sameOffering && $sameIdentifier && $resolved['identity_status'] === 'verified';

            if ($verified) {
                $status = 'verified';
                $instanceId = $resolved['folio_instance_id'];
                $legacyIdentifier = $resolved['legacy_identifier'];
                $legacyType = $resolved['legacy_identifier_type'];
                $provenance = $resolved['provenance'];
            } else {
                $status = 'unverified';
                $instanceId = null;
                $legacy = $identity->resolve(null, ['external_resource_id' => $reference['external_resource_id']]);
                $legacyIdentifier = $reference['external_resource_id'];
                $legacyType = $legacy['legacy_identifier_type'];
                $provenance = $this->unverifiedProvenance($reference, $candidate, $resolved, $items, $sameOffering, $sameIdentifier);
            }

            $this->db->createCommand(
                'UPDATE physical_resource_references SET folio_instance_id = :instance, '
                . 'legacy_identifier = :legacy, legacy_identifier_type = :legacy_type, '
                . 'identity_status = :status, identity_provenance_json = :provenance, updated_at = :updated_at '
                . 'WHERE reference_id = :id', [
                    ':instance' => $instanceId,
                    ':legacy' => $legacyIdentifier,
                    ':legacy_type' => $legacyType,
                    ':status' => $status,
                    ':provenance' => json_encode($provenance, JSON_UNESCAPED_SLASHES),
                    ':updated_at' => $reference['updated_at'],
                    ':id' => $reference['reference_id'],
                ]
            )->execute();
        }
    }

    private function unverifiedProvenance(array $reference, $candidate, $resolved, array $items, $sameOffering, $sameIdentifier)
    {
        if (count($items) > 1) {
            return [
                'evidence_source' => 'materialized_physical_reference_id',
                'item_kind' => null,
                'item_id' => null,
                'matched_field' => 'materialized_physical_reference_id',
                'matched_value' => (int)$reference['reference_id'],
                'outcome' => 'unverified',
                'reason' => 'multiple_materialized_claimants',
            ];
        }

        if (!$candidate) {
            return [
                'evidence_source' => 'materialized_physical_reference_id',
                'item_kind' => null,
                'item_id' => null,
                'matched_field' => null,
                'matched_value' => null,
                'outcome' => 'unverified',
                'reason' => 'no_materialized_item',
            ];
        }

        $provenance = $resolved['provenance'];
        $provenance['outcome'] = 'unverified';
        if (!$sameOffering) {
            $provenance['reason'] = 'offering_mismatch';
        } elseif (!$sameIdentifier && $resolved['identity_status'] === 'verified') {
            $provenance['reason'] = 'external_identifier_mismatch';
        }
        return $provenance;
    }

    private function sameId($left, $right)
    {
        return is_string($left) && is_string($right) && strtolower(trim($left)) === strtolower(trim($right));
    }

    private function addColumnIfMissing($column, $definition)
    {
        $schema = $this->db->schema->getTableSchema('physical_resource_references', true);
        if ($schema && $schema->getColumn($column) === null) {
            $this->addColumn('physical_resource_references', $column, $definition);
        }
    }

    private function createIndexIfMissing($name, $table, $columns)
    {
        foreach ($this->db->schema->getTableIndexes($table, true) as $index) {
            if ($index->name === $name) {
                return;
            }
        }
        $this->createIndex($name, $table, $columns);
    }

    private function dropIndexIfExists($name, $table)
    {
        foreach ($this->db->schema->getTableIndexes($table, true) as $index) {
            if ($index->name === $name) {
                $this->dropIndex($name, $table);
                return;
            }
        }
    }

    private function dropColumnIfExists($column)
    {
        $schema = $this->db->schema->getTableSchema('physical_resource_references', true);
        if ($schema && $schema->getColumn($column) !== null) {
            $this->dropColumn('physical_resource_references', $column);
        }
    }
}

<?php

use PHPUnit\Framework\Assert;

/** Checks API-103 installs the Ebook seed and preserves a later admin version on rollback. */
class Api103EbookMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261029_000001_add_ebook_material_type_flow_and_item_metadata';
    private $customVersion;

    public function _after(FunctionalTester $I)
    {
        if ($this->customVersion !== null) {
            \Yii::$app->db->createCommand()->delete('flow_versions', [
                'created_by' => 'test-api103-migration',
                'version' => $this->customVersion,
            ])->execute();
        }
    }

    public function rollbackPreservesAnAdminCustomizedEbookFlow(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            MigrationRollback::migrate('up');
            $db = \Yii::$app->db;
            $type = $db->createCommand(
                'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name LIMIT 1',
                [':name' => 'ebook']
            )->queryOne();
            Assert::assertNotEmpty($type);
            $flow = $db->createCommand(
                'SELECT f.id, v.version, v.steps_json FROM flows f '
                . 'INNER JOIN material_type_flows m ON m.flow_id = f.id '
                . 'INNER JOIN flow_versions v ON v.flow_id = f.id '
                . 'WHERE m.material_type_id = :type_id AND f.name = :name '
                . 'ORDER BY v.version DESC LIMIT 1',
                [':type_id' => $type['material_type_id'], ':name' => 'Ebook']
            )->queryOne();
            Assert::assertNotEmpty($flow);
            Assert::assertStringContainsString('Do we have access?', $flow['steps_json']);
            foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
                $schema = $db->schema->getTableSchema($table, true);
                Assert::assertNotNull($schema->getColumn('public_note'));
                Assert::assertNotNull($schema->getColumn('assigned_pages'));
            }

            $this->customVersion = (int)$flow['version'] + 1;
            $db->createCommand()->insert('flow_versions', [
                'flow_id' => $flow['id'],
                'version' => $this->customVersion,
                'steps_json' => json_encode([[
                    'key' => 'custom_start',
                    'kind' => 'question',
                    'label' => 'Synthetic admin edit',
                    'outcomes' => [],
                ]]),
                'created_by' => 'test-api103-migration',
            ])->execute();

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar());
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM flow_versions WHERE flow_id = :id AND version = :version',
                [':id' => $flow['id'], ':version' => $this->customVersion]
            )->queryScalar());
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM material_types WHERE material_type_id = :id',
                [':id' => $type['material_type_id']]
            )->queryScalar());
            foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
                $schema = $db->schema->getTableSchema($table, true);
                Assert::assertNull($schema->getColumn('public_note'));
                Assert::assertNull($schema->getColumn('assigned_pages'));
            }
        });

    }
}

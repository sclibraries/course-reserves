<?php

use PHPUnit\Framework\Assert;

/** Verifies unconditional flow seeding and case-insensitive material-type mapping. */
class Api084FlowMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261019_000003_add_staff_workflow_flows';

    public function alwaysSeedsPrintBookAndMapsBookCaseInsensitively(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $originalTypes = $db->createCommand(
            'SELECT material_type_id, name, description, created_at FROM material_types ORDER BY material_type_id'
        )->queryAll();
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar());

        MigrationRollback::withTargetDown($this->migrationVersion, function () use ($db, $originalTypes) {
            $migrationIsDown = true;
            try {
                $this->replaceMaterialTypes([]);
                MigrationRollback::migrate('up');
                $migrationIsDown = false;
                $flow = $this->printBookFlow();
                Assert::assertNotEmpty($flow, 'Migration must always seed the Print book flow.');
                Assert::assertSame(1, (int)$db->createCommand(
                    'SELECT COUNT(*) FROM flow_versions WHERE flow_id = :flow_id',
                    [':flow_id' => $flow['id']]
                )->queryScalar());
                Assert::assertSame(0, (int)$db->createCommand(
                    'SELECT COUNT(*) FROM material_type_flows'
                )->queryScalar(), 'A schema without material types must have no flow mappings.');

                MigrationRollback::migrate('down');
                $migrationIsDown = true;
                $this->replaceMaterialTypes([[
                    'material_type_id' => 0,
                    'name' => 'Book',
                    'description' => 'Synthetic API-084-fr1 case-insensitive migration fixture.',
                    'created_at' => null,
                ]]);

                MigrationRollback::migrate('up');
                $migrationIsDown = false;
                $flow = $this->printBookFlow();
                $bookId = $db->createCommand(
                    'SELECT material_type_id FROM material_types WHERE name = :name LIMIT 1', [':name' => 'Book']
                )->queryScalar();
                Assert::assertSame((int)$flow['id'], (int)$db->createCommand(
                    'SELECT flow_id FROM material_type_flows WHERE material_type_id = :type_id',
                    [':type_id' => $bookId]
                )->queryScalar(), 'Migration must map a material type named Book.');
            } finally {
                if (!$migrationIsDown) {
                    MigrationRollback::migrate('down');
                }
                $this->replaceMaterialTypes($originalTypes);
                MigrationRollback::migrate('up');
            }
        });
    }

    private function printBookFlow()
    {
        return \Yii::$app->db->createCommand(
            'SELECT id FROM flows WHERE name = :name LIMIT 1', [':name' => 'Print book']
        )->queryOne();
    }

    private function replaceMaterialTypes(array $types)
    {
        $db = \Yii::$app->db;
        $db->createCommand('SET FOREIGN_KEY_CHECKS = 0')->execute();
        try {
            $db->createCommand()->delete('material_types')->execute();
            foreach ($types as $type) {
                $values = [
                    'name' => $type['name'],
                    'description' => $type['description'],
                ];
                if ((int)$type['material_type_id'] > 0) {
                    $values['material_type_id'] = (int)$type['material_type_id'];
                }
                if ($type['created_at'] !== null) {
                    $values['created_at'] = $type['created_at'];
                }
                $db->createCommand()->insert('material_types', $values)->execute();
            }
        } finally {
            $db->createCommand('SET FOREIGN_KEY_CHECKS = 1')->execute();
        }
    }
}

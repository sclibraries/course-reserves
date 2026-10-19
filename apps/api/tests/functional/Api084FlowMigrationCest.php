<?php

use PHPUnit\Framework\Assert;

/** Verifies the conditional Print book seed and its material type mapping. */
class Api084FlowMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261019_000003_add_staff_workflow_flows';

    public function seedsPrintBookOnlyWhenTheBookMaterialTypeExists(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $createdBook = false;
        $bookId = null;
        try {
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar());
            $bookId = $db->createCommand(
                'SELECT material_type_id FROM material_types WHERE name = :name LIMIT 1', [':name' => 'book']
            )->queryScalar();
            if (!$bookId) {
                Assert::assertSame(0, (int)$db->createCommand(
                    'SELECT COUNT(*) FROM flows WHERE name = :name', [':name' => 'Print book']
                )->queryScalar(), 'Migration must skip the seed when book material type is absent.');
            }

            $this->runMigration('down');
            $migrationIsDown = true;
            if (!$bookId) {
                $db->createCommand()->insert('material_types', [
                    'name' => 'book', 'description' => 'Synthetic API-084 seed material type',
                ])->execute();
                $bookId = (int)$db->getLastInsertID();
                $createdBook = true;
            }
            $this->runMigration('up');
            $migrationIsDown = false;
            $flow = $db->createCommand('SELECT id FROM flows WHERE name = :name', [':name' => 'Print book'])->queryOne();
            Assert::assertNotEmpty($flow, 'Migration must seed the Print book flow when book exists.');
            $version = $db->createCommand(
                'SELECT steps_json FROM flow_versions WHERE flow_id = :flow_id AND version = 1',
                [':flow_id' => $flow['id']]
            )->queryOne();
            $steps = json_decode($version['steps_json'], true);
            Assert::assertSame([
                'own_it', 'available', 'recall', 'pull', 'folio_reserve', 'confirm', 'on_reserve', 'unavailable',
            ], array_column($steps, 'key'));
            Assert::assertSame((int)$flow['id'], (int)$db->createCommand(
                'SELECT flow_id FROM material_type_flows WHERE material_type_id = :type_id',
                [':type_id' => $bookId]
            )->queryScalar());
            Assert::assertSame('YES', $db->createCommand(
                'SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() '
                . 'AND TABLE_NAME = "workflow_events" AND COLUMN_NAME = "submission_id"'
            )->queryScalar());
        } finally {
            if (!$migrationIsDown) {
                $this->runMigration('down');
                $migrationIsDown = true;
            }
            if ($createdBook) {
                $db->createCommand()->delete('material_types', ['material_type_id' => $bookId])->execute();
            }
            $this->runMigration('up');
        }
    }

    private function runMigration($direction)
    {
        $db = \Yii::$app->db;
        if ($db->isActive) {
            $transaction = $db->getTransaction();
            if ($transaction !== null && $transaction->isActive) {
                $transaction->commit();
            }
            $db->close();
        }
        $output = [];
        $status = 0;
        exec('cd /app && php yii migrate/' . $direction . ' 1 --interactive=0 2>&1', $output, $status);
        Assert::assertSame(0, $status, implode("\n", $output));
    }
}

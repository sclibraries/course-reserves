<?php

use PHPUnit\Framework\Assert;

/** Verifies saved navigation pin tables roll back and reapply. */
class Api100StaffNavPinsMigrationCest extends BaseFunctionalCest
{
    const VERSION = 'm261027_000001_create_staff_nav_pins';

    public function createsAndReversesPinTables(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $this->assertSchema(false);
            MigrationRollback::migrate('up');
            $this->assertSchema(true);

            MigrationRollback::migrate('down');
            $this->assertSchema(false);
            MigrationRollback::migrate('up');
            $this->assertSchema(true);
        });
    }

    private function assertSchema($present)
    {
        $db = \Yii::$app->db;
        $db->schema->refresh();
        $expectedColumns = [
            'staff_nav_pins' => ['user_id', 'pins', 'updated_at'],
            'staff_nav_pin_defaults' => ['id', 'pins', 'updated_by', 'updated_at'],
        ];

        foreach ($expectedColumns as $table => $names) {
            $schema = $db->getTableSchema($table, true);
            Assert::assertSame($present, $schema !== null, $table . ' presence');
            if ($present) {
                foreach ($names as $name) {
                    Assert::assertArrayHasKey($name, $schema->columns, $table . '.' . $name);
                }
            }
        }

        if (!$present) {
            return;
        }

        Assert::assertSame('user_id', $db->getTableSchema('staff_nav_pins', true)->primaryKey[0]);
        Assert::assertSame('id', $db->getTableSchema('staff_nav_pin_defaults', true)->primaryKey[0]);
        Assert::assertSame('CASCADE', $this->deleteRule('staff_nav_pins', 'fk_staff_nav_pins_user'));
        Assert::assertSame('SET NULL', $this->deleteRule('staff_nav_pin_defaults', 'fk_staff_nav_pin_defaults_updated_by'));
    }

    private function deleteRule($table, $constraint)
    {
        return \Yii::$app->db->createCommand(
            'SELECT [[DELETE_RULE]] FROM information_schema.REFERENTIAL_CONSTRAINTS '
            . 'WHERE [[CONSTRAINT_SCHEMA]] = DATABASE() AND [[TABLE_NAME]] = :table '
            . 'AND [[CONSTRAINT_NAME]] = :constraint',
            [':table' => $table, ':constraint' => $constraint]
        )->queryScalar();
    }
}

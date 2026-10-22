<?php

use PHPUnit\Framework\Assert;

/** Runs a migration test with its target and newer applied migrations rolled back. */
class MigrationRollback
{
    public static function withTargetDown($targetVersion, callable $test)
    {
        $versions = self::appliedVersionsFrom($targetVersion);
        $rolledBack = [];
        try {
            foreach ($versions as $version) {
                $rolledBack[] = $version;
                self::migrate('down');
                Assert::assertFalse(self::isApplied($version), 'Migration was not rolled back: ' . $version);
            }
            return call_user_func($test);
        } finally {
            try {
                foreach (array_reverse($rolledBack) as $version) {
                    if (!self::isApplied($version)) {
                        self::migrate('up');
                        Assert::assertTrue(self::isApplied($version), 'Migration was not restored: ' . $version);
                    }
                }
            } finally {
                \Yii::$app->db->schema->refresh();
            }
        }
    }

    public static function migrate($direction)
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
        $exitCode = 0;
        exec('cd /app && php yii migrate/' . $direction . ' 1 --interactive=0 2>&1', $output, $exitCode);
        Assert::assertSame(0, $exitCode, implode("\n", $output));
        return implode("\n", $output);
    }

    private static function appliedVersionsFrom($targetVersion)
    {
        $versions = \Yii::$app->db->createCommand(
            'SELECT [[version]] FROM {{%migration}} ORDER BY [[version]] DESC'
        )->queryColumn();
        $versions = array_values(array_filter($versions, function ($version) use ($targetVersion) {
            return strcmp($version, $targetVersion) >= 0;
        }));
        Assert::assertContains($targetVersion, $versions, 'Target migration must be applied by test-stack setup.');
        return $versions;
    }

    private static function isApplied($version)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $version]
        )->queryScalar() === 1;
    }
}

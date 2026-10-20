<?php

use PHPUnit\Framework\Assert;
use yii\db\Query;

class FacultySubmissionConfirmationMigrationCest
{
    private $migrationVersion = 'm261014_000001_add_confirmation_delivery_state';
    private $proxyMigrationVersion = 'm261014_000002_add_proxy_invitation_expiry';
    private $api074MigrationVersion = 'm261015_000001_add_faculty_internal_id_to_proxy_permissions';
    private $api079MigrationVersion = 'm261016_000001_add_roster_course_to_faculty_submissions';
    private $api080MigrationVersion = 'm261016_000002_add_workflow_linking';
    private $api081MigrationVersion = 'm261016_000003_add_link_suggestions';
    private $api082MigrationVersion = 'm261019_000001_add_item_claims';
    private $api083MigrationVersion = 'm261019_000002_add_staff_groups';
    private $api084MigrationVersion = 'm261019_000003_add_staff_workflow_flows';
    private $api086MigrationVersion = 'm261020_000001_add_submission_draft_version';
    private $facultyId = 'test-api032-migration-faculty';

    /**
     * The API test runner applies migrations before Codeception; this test then runs
     * php yii migrate/down 1 and migrate/up 1 in that same isolated MariaDB stack.
     */
    public function historicalRowsKeepTheirProvenanceAcrossMigrationCycle(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $confirmationMigrationIsDown = false;
        $proxyMigrationIsDown = false;
        $api074MigrationIsDown = false;
        $api079MigrationIsDown = false;
        $api080MigrationIsDown = false;
        $api081MigrationIsDown = false;
        $api082MigrationIsDown = false;
        $api083MigrationIsDown = false;
        $api084MigrationIsDown = false;
        $api086MigrationIsDown = false;

        try {
            $applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $applied, 'API-032 migration must be applied by test-stack setup.');

            $proxyMigrationApplied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->proxyMigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $proxyMigrationApplied, 'API-070 migration must be applied by test-stack setup.');

            $api074MigrationApplied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api074MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api074MigrationApplied, 'API-074 migration must be applied by test-stack setup.');

            $api079MigrationApplied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api079MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api079MigrationApplied, 'API-079 migration must be applied by test-stack setup.');
            $api080MigrationApplied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api080MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api080MigrationApplied, 'API-080 migration must be applied by test-stack setup.');
            $api081MigrationApplied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api081MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api081MigrationApplied, 'API-081 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api082MigrationVersion]
            )->queryScalar(), 'API-082 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api083MigrationVersion]
            )->queryScalar(), 'API-083 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api084MigrationVersion]
            )->queryScalar(), 'API-084 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api086MigrationVersion]
            )->queryScalar(), 'API-086 migration must be applied by test-stack setup.');

            // Roll back later migrations so migrate/down 1 targets the confirmation migration.
            $this->runMigration('down');
            $api086MigrationIsDown = true;
            $this->runMigration('down');
            $api084MigrationIsDown = true;
            $this->runMigration('down');
            $api083MigrationIsDown = true;
            $this->runMigration('down');
            $api082MigrationIsDown = true;
            $this->runMigration('down');
            $api081MigrationIsDown = true;
            $this->runMigration('down');
            $api080MigrationIsDown = true;
            $this->runMigration('down');
            $api079MigrationIsDown = true;
            $this->runMigration('down');
            $api074MigrationIsDown = true;
            $this->runMigration('down');
            $proxyMigrationIsDown = true;
            $confirmationMigrationIsDown = true;
            $this->runMigration('down');
            $db->schema->refreshTableSchema('faculty_submissions');

            $this->insertLegacyRow($db, 'API032-HIST-1', 1);
            $this->insertLegacyRow($db, 'API032-HIST-0', 0);

            $this->runMigration('up');
            $confirmationMigrationIsDown = false;
            $db->schema->refreshTableSchema('faculty_submissions');
            $this->assertMigratedRows($db);

            $confirmationMigrationIsDown = true;
            $this->runMigration('down');
            $db->schema->refreshTableSchema('faculty_submissions');
            Assert::assertSame(1, (int) $this->rowForCourse($db, 'API032-HIST-1')['email_confirmation_sent']);
            Assert::assertSame(0, (int) $this->rowForCourse($db, 'API032-HIST-0')['email_confirmation_sent']);

            $this->runMigration('up');
            $confirmationMigrationIsDown = false;
            $db->schema->refreshTableSchema('faculty_submissions');
            $this->assertMigratedRows($db);

            $this->runMigration('up');
            $proxyMigrationIsDown = false;
            $this->runMigration('up');
            $api074MigrationIsDown = false;
            $this->runMigration('up');
            $api079MigrationIsDown = false;
            $this->runMigration('up');
            $api080MigrationIsDown = false;
            $this->runMigration('up');
            $api081MigrationIsDown = false;
            $this->runMigration('up');
            $api082MigrationIsDown = false;
            $this->runMigration('up');
            $api083MigrationIsDown = false;
            $this->runMigration('up');
            $api084MigrationIsDown = false;
            $this->runMigration('up');
            $api086MigrationIsDown = false;
            foreach (['API032-HIST-1', 'API032-HIST-0'] as $courseCode) {
                $row = $this->rowForCourse($db, $courseCode);
                $submission = \app\models\FacultySubmission::findOne($row['submission_id']);
                $submission->submission_notes = 'unrelated synthetic update';
                Assert::assertTrue($submission->save(), json_encode($submission->errors));
            }
            $this->assertMigratedRows($db);

            $output = $this->runMigration('up');
            Assert::assertStringContainsString('No new migrations found', $output);
            $this->assertMigratedRows($db);
        } finally {
            if ($confirmationMigrationIsDown) {
                $this->runMigration('up');
            }
            if ($proxyMigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api074MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api079MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api080MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api081MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api082MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api083MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api084MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api086MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            $db->schema->refreshTableSchema('faculty_submissions');
            $db->createCommand()
                ->delete('faculty_submissions', ['shibboleth_user_id' => $this->facultyId])
                ->execute();
        }
    }

    private function insertLegacyRow($db, $courseCode, $sent)
    {
        $db->createCommand()->insert('faculty_submissions', [
            'shibboleth_user_id' => $this->facultyId,
            'term_code' => '2026FA',
            'course_code' => $courseCode,
            'section' => '01',
            'course_title' => 'Synthetic Migration Test',
            'status' => 'submitted',
            'email_confirmation_sent' => $sent,
        ])->execute();
    }

    private function assertMigratedRows($db)
    {
        $sentRow = $this->rowForCourse($db, 'API032-HIST-1');
        Assert::assertSame('legacy_unknown', $sentRow['email_confirmation_status']);
        Assert::assertSame(0, (int) $sentRow['email_confirmation_sent']);
        Assert::assertSame(1, (int) $sentRow['email_confirmation_legacy_sent']);
        $submission = \app\models\FacultySubmission::findOne($sentRow['submission_id']);
        Assert::assertArrayNotHasKey('email_confirmation_legacy_sent', $submission->toArray());

        $notSentRow = $this->rowForCourse($db, 'API032-HIST-0');
        Assert::assertSame('not_requested', $notSentRow['email_confirmation_status']);
        Assert::assertSame(0, (int) $notSentRow['email_confirmation_sent']);
        Assert::assertSame(0, (int) $notSentRow['email_confirmation_legacy_sent']);
    }

    private function rowForCourse($db, $courseCode)
    {
        return (new Query())
            ->from('faculty_submissions')
            ->where([
                'shibboleth_user_id' => $this->facultyId,
                'course_code' => $courseCode,
            ])
            ->one($db);
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
        $exitCode = 0;
        exec('cd /app && php yii migrate/' . $direction . ' 1 --interactive=0 2>&1', $output, $exitCode);
        Assert::assertSame(0, $exitCode, implode("\n", $output));

        return implode("\n", $output);
    }
}

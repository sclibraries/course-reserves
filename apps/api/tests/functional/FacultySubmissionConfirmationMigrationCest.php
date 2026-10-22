<?php

use PHPUnit\Framework\Assert;
use yii\db\Query;

class FacultySubmissionConfirmationMigrationCest
{
    private $migrationVersion = 'm261014_000001_add_confirmation_delivery_state';
    private $facultyId = 'test-api032-migration-faculty';

    public function historicalRowsKeepTheirProvenanceAcrossMigrationCycle(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar(), 'API-032 migration must be applied by test-stack setup.');

        try {
            MigrationRollback::withTargetDown($this->migrationVersion, function () use ($db) {
                $db->schema->refreshTableSchema('faculty_submissions');
                $this->insertLegacyRow($db, 'API032-HIST-1', 1);
                $this->insertLegacyRow($db, 'API032-HIST-0', 0);

                MigrationRollback::migrate('up');
                $db->schema->refreshTableSchema('faculty_submissions');
                $this->assertMigratedRows($db);

                MigrationRollback::migrate('down');
                $db->schema->refreshTableSchema('faculty_submissions');
                Assert::assertSame(1, (int)$this->rowForCourse($db, 'API032-HIST-1')['email_confirmation_sent']);
                Assert::assertSame(0, (int)$this->rowForCourse($db, 'API032-HIST-0')['email_confirmation_sent']);

                MigrationRollback::migrate('up');
                $db->schema->refreshTableSchema('faculty_submissions');
                $this->assertMigratedRows($db);
            });

            foreach (['API032-HIST-1', 'API032-HIST-0'] as $courseCode) {
                $row = $this->rowForCourse($db, $courseCode);
                $submission = \app\models\FacultySubmission::findOne($row['submission_id']);
                $submission->submission_notes = 'unrelated synthetic update';
                Assert::assertTrue($submission->save(), json_encode($submission->errors));
            }
            $this->assertMigratedRows($db);
            $output = MigrationRollback::migrate('up');
            Assert::assertStringContainsString('No new migrations found', $output);
            $this->assertMigratedRows($db);
        } finally {
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
        Assert::assertSame(0, (int)$sentRow['email_confirmation_sent']);
        Assert::assertSame(1, (int)$sentRow['email_confirmation_legacy_sent']);
        $submission = \app\models\FacultySubmission::findOne($sentRow['submission_id']);
        Assert::assertArrayNotHasKey('email_confirmation_legacy_sent', $submission->toArray());

        $notSentRow = $this->rowForCourse($db, 'API032-HIST-0');
        Assert::assertSame('not_requested', $notSentRow['email_confirmation_status']);
        Assert::assertSame(0, (int)$notSentRow['email_confirmation_sent']);
        Assert::assertSame(0, (int)$notSentRow['email_confirmation_legacy_sent']);
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
}

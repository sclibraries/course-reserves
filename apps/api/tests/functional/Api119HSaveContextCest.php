<?php

require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';
require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;
use app\services\FacultySaveContext;

class Api119HSaveContextCest extends Api116ADestinationRegistryTestBase
{
    private $commandClass;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->commandClass = \Yii::$app->db->commandClass;
        \Yii::$app->db->commandClass = Api119A2FailingCommand::class;
        Api119A2FailingCommand::clearConfiguration();
    }

    public function _after(FunctionalTester $I)
    {
        Api119A2FailingCommand::clearConfiguration();
        \Yii::$app->db->commandClass = $this->commandClass;
        parent::_after($I);
    }

    public function locksOnlyTheSubmissionItemsAndFoldersInOrder(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $submissionId = $this->owner['submission_id'];
        $db->createCommand()->insert('submission_folders', [
            'submission_id' => $submissionId,
            'folder_name' => 'Synthetic context folder A',
            'display_order' => 1,
        ])->execute();
        $firstFolderId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_folders', [
            'submission_id' => $submissionId,
            'folder_name' => 'Synthetic context folder B',
            'display_order' => 2,
        ])->execute();
        $secondFolderId = (int)$db->getLastInsertID();
        $db->createCommand()->update('submission_new_resources', [
            'folder_name' => 'Synthetic context folder A',
        ], ['id' => $this->owner['id']])->execute();
        $db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'resource_data' => json_encode(['title' => 'Synthetic context sibling']),
            'folder_name' => 'Synthetic context folder B',
            'item_status' => 'pending',
        ])->execute();
        $secondNewId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'source_snapshot_json' => json_encode(['title' => 'Synthetic context reuse']),
            'folder_name' => 'Synthetic context folder B',
            'item_status' => 'pending',
        ])->execute();
        $reuseId = (int)$db->getLastInsertID();

        $foreignFolderName = 'Synthetic foreign context folder';
        $db->createCommand()->insert('submission_folders', [
            'submission_id' => $this->otherItem['submission_id'],
            'folder_name' => $foreignFolderName,
        ])->execute();
        $db->createCommand()->update('submission_new_resources', [
            'folder_name' => $foreignFolderName,
        ], ['id' => $this->otherItem['id']])->execute();

        $evaluatedAt = time();
        $transaction = $db->beginTransaction();
        try {
            Api119A2FailingCommand::resetQueries();
            $context = (new FacultySaveContext())->load($submissionId, $evaluatedAt);

            Assert::assertInstanceOf(\app\models\FacultySubmission::class, $context['submission']);
            Assert::assertSame($evaluatedAt, $context['evaluated_at']);
            Assert::assertSame([$this->owner['id'], $secondNewId], array_keys($context['items']['new']));
            Assert::assertSame([$reuseId], array_keys($context['items']['reuse']));
            Assert::assertSame($this->owner['id'], (int)$context['items']['new'][$this->owner['id']]->id);
            Assert::assertSame(
                'Synthetic context folder A',
                $context['item_attributes']['new'][$this->owner['id']]['folder_name']
            );
            Assert::assertSame(
                'Synthetic context folder B',
                $context['item_attributes']['reuse'][$reuseId]['folder_name']
            );
            Assert::assertSame([$firstFolderId, $secondFolderId], array_keys($context['folders']));
            Assert::assertSame($firstFolderId, $context['grouping']['containers']['new'][$this->owner['id']]);
            Assert::assertSame($secondFolderId, $context['grouping']['containers']['reuse'][$reuseId]);
            Assert::assertArrayNotHasKey($this->otherItem['id'], $context['grouping']['containers']['new']);
            Assert::assertNotContains($foreignFolderName, array_column($context['folders'], 'folder_name'));

            $lockingQueries = array_values(array_filter(Api119A2FailingCommand::queries(), function ($sql) {
                return preg_match('/\bFOR UPDATE\s*$/i', $sql);
            }));
            $lockingTables = array_map(function ($sql) {
                preg_match('/\bFROM\s+`?([a-z_]+)/i', $sql, $matches);
                return $matches[1];
            }, $lockingQueries);
            Assert::assertSame([
                'faculty_submissions',
                'submission_new_resources',
                'submission_reuse_resources',
                'submission_folders',
                'item_flow_runs',
                'publication_attachments',
                'publication_destinations',
                'item_history_review',
            ], $lockingTables);
            Assert::assertStringContainsString(
                'WHERE submission_id = ' . $submissionId,
                $lockingQueries[3]
            );

            Assert::assertNull((new FacultySaveContext())->load(-1, $evaluatedAt));
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
        }
        $originalDb = \Yii::$app->db;
        $unforced = Api116B1CommittedConnection::unforced($originalDb);
        \Yii::$app->set('db', $unforced);
        try {
            (new FacultySaveContext())->load($this->owner['submission_id'], time());
            Assert::fail('Expected the faculty save context to require an active transaction.');
        } catch (\LogicException $exception) {
            Assert::assertSame('Faculty save context requires an active transaction.', $exception->getMessage());
        } finally {
            \Yii::$app->set('db', $originalDb);
            $unforced->close();
        }
    }
}

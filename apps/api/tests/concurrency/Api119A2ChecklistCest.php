<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';
require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use PHPUnit\Framework\Assert;

class Api119A2ChecklistCest extends Api116B1ConcurrencyCase
{
    private $fixture;
    private $prefix;
    private $workerConnections = [];

    public function _before(ConcurrencyTester $I)
    {
        parent::_before($I);
        $this->prefix = 'test-api119a2-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $this->fixture = new Api119A2ChecklistFixture($this->prefix);
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        $this->fixture->cleanup();
        parent::_after($I);
    }

    public function completionAndFacultyDeletionSerializeInBothOrders(ConcurrencyTester $I)
    {
        $completionFirst = $this->checkedItem('completion-first');
        $this->startChecklistWorker('complete-first', 'checklist_complete', [
            'item_id' => $completionFirst['submission']['item_id'],
            'pause_after' => 'item_locked',
        ]);
        $this->supervisor->awaitPhase('complete-first', 'locked', 1);
        $this->startChecklistWorker('delete-after', 'faculty_delete', [
            'submission_id' => $completionFirst['submission']['submission_id'],
            'pause_before_action' => true,
        ]);
        $this->supervisor->awaitPhase('delete-after', 'locked', 1);
        $this->releaseIntoSubmissionWait('delete-after', 'locked', $completionFirst['submission']['submission_id']);
        $this->supervisor->release('complete-first', 'locked', 1);
        $completed = $this->supervisor->complete('complete-first');
        $deleted = $this->supervisor->complete('delete-after');
        Assert::assertTrue($completed['result']['success']);
        $this->assertLockOrder($completed['queries']);
        Assert::assertSame(['deleted' => true], $deleted['result']);
        Assert::assertSame([], $this->rowsForItem($completionFirst['submission']['item_id']));

        $deletionFirst = $this->checkedItem('deletion-first');
        $this->startChecklistWorker('delete-first', 'faculty_delete', [
            'submission_id' => $deletionFirst['submission']['submission_id'],
            'pause_after' => 'faculty_item_deleted',
        ]);
        $this->supervisor->awaitPhase('delete-first', 'locked', 1);
        $this->startChecklistWorker('complete-after', 'checklist_complete', [
            'item_id' => $deletionFirst['submission']['item_id'],
            'pause_after' => 'discovered',
        ]);
        $this->supervisor->awaitPhase('complete-after', 'discovered', 1);
        $this->releaseIntoSubmissionWait('complete-after', 'discovered', $deletionFirst['submission']['submission_id']);
        $this->supervisor->release('delete-first', 'locked', 1);
        $deleted = $this->supervisor->complete('delete-first');
        $notFound = $this->supervisor->complete('complete-after');
        $this->assertWorkerFailure($notFound['result'], 404);
        $this->assertLockPrefix($notFound['queries'], 2);
        Assert::assertSame(['deleted' => true], $deleted['result']);
        Assert::assertSame([], $this->rowsForItem($deletionFirst['submission']['item_id']));
    }

    public function uncompletionUsesCurrentLockedRowsAndAssociationChangesRetry(ConcurrencyTester $I)
    {
        $current = $this->checkedItem('current-task-value');
        $this->startChecklistWorker('current-complete', 'checklist_complete', [
            'item_id' => $current['submission']['item_id'], 'pause_after' => 'discovered',
        ]);
        $this->supervisor->awaitPhase('current-complete', 'discovered', 1);
        $this->startChecklistWorker('current-uncomplete', 'checklist_update', [
            'item_id' => $current['submission']['item_id'],
            'task_id' => $current['checklist']['task_ids'][0],
            'body' => ['completed' => false],
        ]);
        Assert::assertTrue($this->supervisor->complete('current-uncomplete')['result']['success']);
        $beforeRejection = $this->fixture->snapshot($current['submission']['item_id']);
        $this->supervisor->release('current-complete', 'discovered', 1);
        $this->assertWorkerFailure($this->supervisor->complete('current-complete')['result'], 400);
        Assert::assertSame($beforeRejection, $this->fixture->snapshot($current['submission']['item_id']));
        Assert::assertSame(0, (int)$this->task($current['checklist']['task_ids'][0])['completed']);
        Assert::assertNull($this->checklist($current['checklist']['id'])['completed_at']);

        $completionFirst = $this->checkedItem('completion-before-uncompletion');
        $this->startChecklistWorker('task-completion-first', 'checklist_complete', [
            'item_id' => $completionFirst['submission']['item_id'], 'pause_after' => 'item_locked',
        ]);
        $this->supervisor->awaitPhase('task-completion-first', 'locked', 1);
        $this->startChecklistWorker('task-uncomplete-after', 'checklist_update', [
            'item_id' => $completionFirst['submission']['item_id'],
            'task_id' => $completionFirst['checklist']['task_ids'][0],
            'body' => ['completed' => false],
            'pause_before_action' => true,
        ]);
        $this->supervisor->awaitPhase('task-uncomplete-after', 'locked', 1);
        $this->releaseIntoSubmissionWait(
            'task-uncomplete-after', 'locked', $completionFirst['submission']['submission_id']
        );
        $this->supervisor->release('task-completion-first', 'locked', 1);
        $completed = $this->supervisor->complete('task-completion-first');
        $uncompleted = $this->supervisor->complete('task-uncomplete-after');
        Assert::assertTrue($completed['result']['success']);
        Assert::assertTrue($uncompleted['result']['success']);
        $this->assertLockOrder($completed['queries']);
        Assert::assertSame('completed', $this->rowsForItem($completionFirst['submission']['item_id'])[0]['item_status']);
        Assert::assertSame(0, (int)$this->task($completionFirst['checklist']['task_ids'][0])['completed']);

        $association = $this->checkedItem('association-change');
        $newSubmission = $this->fixture->submission('association-target');
        $this->startChecklistWorker('association', 'checklist_complete', [
            'item_id' => $association['submission']['item_id'], 'pause_after' => 'discovered',
        ]);
        $this->supervisor->awaitPhase('association', 'discovered', 1);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'submission_id' => $newSubmission['submission_id'],
        ], ['id' => $association['submission']['item_id']])->execute();
        $this->supervisor->release('association', 'discovered', 1);
        $result = $this->supervisor->complete('association');
        Assert::assertTrue($result['result']['success']);
        Assert::assertSame(2, $this->countQueries(
            $result['queries'], '/SELECT submission_id FROM submission_new_resources WHERE id =/i'
        ));
        Assert::assertSame(
            $newSubmission['submission_id'],
            (int)$this->rowsForItem($association['submission']['item_id'])[0]['submission_id']
        );
        $this->assertLockPrefix($result['queries'], 2);
    }

    public function completionRetriesWhenMariaDbChoosesItAsTheDeadlockVictim(ConcurrencyTester $I)
    {
        $case = $this->checkedItem('real-deadlock', 20);
        $itemId = $case['submission']['item_id'];
        $checklistId = $case['checklist']['id'];
        $this->startChecklistWorker('task-holder', 'checklist_hold_task_locks', [
            'item_id' => $itemId, 'checklist_id' => $checklistId,
        ]);
        $this->supervisor->awaitPhase('task-holder', 'locked', 1);
        $this->startChecklistWorker('deadlock-complete', 'checklist_complete', ['item_id' => $itemId]);
        $this->awaitWorkerQuery(
            $this->workerConnections['deadlock-complete'],
            '/FROM\s+item_checklist_tasks.*FOR UPDATE/i'
        );
        $this->assertTaskIsContended($case['checklist']['task_ids'][0]);
        $this->supervisor->release('task-holder', 'locked', 1);
        $this->supervisor->complete('task-holder');
        $result = $this->supervisor->complete('deadlock-complete');
        Assert::assertTrue($result['result']['success']);
        Assert::assertSame(2, $this->countQueries(
            $result['queries'], '/SELECT \* FROM submission_new_resources WHERE id = .*FOR UPDATE/i'
        ));
        $this->assertLockOrder($result['queries']);
        Assert::assertSame('completed', $this->rowsForItem($itemId)[0]['item_status']);
        Assert::assertNotNull($this->checklist($checklistId)['completed_at']);
    }

    private function checkedItem($suffix, $taskCount = 1)
    {
        $submission = $this->fixture->submission($suffix);
        $template = $this->fixture->template(array_fill(0, $taskCount, false));
        $checklist = $this->fixture->checklist($submission['item_id'], $template);
        \Yii::$app->db->createCommand()->update('item_checklist_tasks', [
            'completed' => 1,
            'completed_at' => '2026-11-17 12:00:00',
            'completed_by' => 'test-api119a2-staff',
        ], ['item_checklist_id' => $checklist['id']])->execute();
        return compact('submission', 'checklist');
    }

    private function startChecklistWorker($label, $operation, array $payload)
    {
        $this->supervisor->start($label, ['op' => $operation] + $payload);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('reserves_test', $ready['database']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        $this->workerConnections[$label] = (int)$ready['connection_id'];
        $this->connections[$label] = (int)$ready['connection_id'];
        $this->supervisor->release($label, 'ready', 0);
        return $ready;
    }

    private function releaseIntoSubmissionWait($label, $phase, $submissionId)
    {
        $this->releaseIntoWait($label, $phase, function () use ($submissionId) {
            return $this->lockProbe('submission', $submissionId);
        }, '/FROM\s+`?faculty_submissions`?\s+WHERE\s+`?submission_id`?.*FOR UPDATE/i');
    }

    private function assertWorkerFailure(array $result, $status)
    {
        Assert::assertSame($status, $result['status_code']);
    }

    private function assertLockOrder(array $queries)
    {
        $this->assertLockPrefix($queries, 4);
    }

    private function assertLockPrefix(array $queries, $count)
    {
        $locks = array_values(array_filter($queries, function ($sql) {
            return preg_match('/\b(FOR UPDATE|LOCK IN SHARE MODE)\b/i', $sql);
        }));
        $patterns = [
            '/FROM faculty_submissions.*FOR UPDATE/i',
            '/FROM submission_new_resources.*FOR UPDATE/i',
            '/FROM item_checklists.*FOR UPDATE/i',
            '/FROM item_checklist_tasks.*ORDER BY.*FOR UPDATE/i',
        ];
        foreach (array_slice($patterns, 0, $count) as $index => $pattern) {
            Assert::assertRegExp($pattern, $locks[$index] ?? '');
        }
    }

    private function awaitWorkerQuery($connectionId, $pattern)
    {
        $deadline = microtime(true) + 8;
        while (microtime(true) < $deadline) {
            $thread = \Yii::$app->db->createCommand(
                'SELECT COMMAND, TIME_MS, INFO FROM information_schema.PROCESSLIST WHERE ID = :id',
                [':id' => $connectionId]
            )->queryOne();
            if ($thread && $thread['COMMAND'] === 'Query' && preg_match($pattern, (string)$thread['INFO'])) {
                return;
            }
            usleep(50000);
        }
        Assert::fail('Checklist worker did not block on ' . $pattern . ': ' . json_encode($thread));
    }

    private function assertTaskIsContended($taskId)
    {
        $db = \Yii::$app->db;
        $db->createCommand('SET SESSION innodb_lock_wait_timeout = 1')->execute();
        $transaction = $db->beginTransaction();
        try {
            $db->createCommand(
                'SELECT id FROM item_checklist_tasks WHERE id = :id FOR UPDATE', [':id' => $taskId]
            )->queryScalar();
            Assert::fail('The completion worker did not hold the checklist task lock.');
        } catch (\yii\db\Exception $exception) {
            Assert::assertSame(1205, (int)$exception->errorInfo[1]);
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            $db->createCommand('SET SESSION innodb_lock_wait_timeout = 10')->execute();
        }
    }

    private function countQueries(array $queries, $pattern)
    {
        return count(array_filter($queries, function ($sql) use ($pattern) {
            return preg_match($pattern, $sql);
        }));
    }

    private function rowsForItem($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $itemId]
        )->queryAll();
    }

    private function task($taskId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_checklist_tasks WHERE id = :id', [':id' => $taskId]
        )->queryOne();
    }

    private function checklist($checklistId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_checklists WHERE id = :id', [':id' => $checklistId]
        )->queryOne();
    }
}

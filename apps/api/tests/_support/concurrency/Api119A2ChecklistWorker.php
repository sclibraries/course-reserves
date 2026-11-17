<?php

use yii\web\IdentityInterface;

class Api119A2ChecklistWorkerIdentity implements IdentityInterface
{
    public $id = '999119021';
    public $username = 'test-api119a2-staff';
    public $role = 'staff';

    public static function findIdentity($id)
    {
        return null;
    }

    public static function findIdentityByAccessToken($token, $type = null)
    {
        return null;
    }

    public function getId()
    {
        return $this->id;
    }

    public function getAuthKey()
    {
        return null;
    }

    public function validateAuthKey($authKey)
    {
        return false;
    }
}

/** Runs the real checklist actions in independent web-app workers with SQL-driven barriers. */
class Api119A2ChecklistWorker
{
    private static $request;
    private static $paused = false;

    public static function run($operation, array $request, $db)
    {
        self::$request = $request;
        self::$paused = false;
        \Yii::$app->user->setIdentity(new Api119A2ChecklistWorkerIdentity());
        if (isset($request['pause_before_action'])) {
            self::checkpoint('locked', null);
        }
        if (isset($request['pause_after'])) {
            Api119A2ChecklistConcurrencyCommand::setObserver(function ($sql) {
                if (self::matches(self::$request['pause_after'], $sql)) {
                    self::checkpoint(self::phaseFor(self::$request['pause_after']), $sql);
                }
            });
        }

        try {
            if ($operation === 'checklist_hold_task_locks') {
                return self::holdTasksThenItem($request, $db);
            }
            if ($operation === 'faculty_delete') {
                $result = (new \app\services\SubmittedSubmissionUpdateService())->update(
                    $request['submission_id'], ['items' => []]
                );
                if (isset($result['status_code'])) {
                    throw new \yii\web\HttpException($result['status_code'], 'Synthetic faculty edit failed.');
                }
                return ['deleted' => true];
            }

            $httpRequest = \Yii::$app->request;
            $httpRequest->setQueryParams([
                'itemId' => $request['item_id'] ?? null,
                'taskId' => $request['task_id'] ?? null,
            ]);
            $httpRequest->setBodyParams($request['body'] ?? []);
            $controller = new \app\controllers\ChecklistController('checklist', \Yii::$app);
            if ($operation === 'checklist_complete') {
                return $controller->actionCompleteChecklist();
            }
            if ($operation === 'checklist_update') {
                return $controller->actionUpdateTask();
            }
            if ($operation === 'checklist_assign') {
                return $controller->actionAssignChecklist();
            }
            throw new \RuntimeException('Unknown checklist worker operation: ' . $operation);
        } catch (\yii\web\HttpException $exception) {
            return ['status_code' => $exception->statusCode, 'message' => $exception->getMessage()];
        } finally {
            Api119A2ChecklistConcurrencyCommand::setObserver(null);
        }
    }

    private static function holdTasksThenItem(array $request, $db)
    {
        $transaction = $db->beginTransaction();
        try {
            $tasks = \app\models\ItemChecklistTask::findBySql(
                'SELECT * FROM item_checklist_tasks WHERE item_checklist_id = :id ORDER BY id FOR UPDATE',
                [':id' => $request['checklist_id']]
            )->all();
            foreach ($tasks as $task) {
                $db->createCommand()->update('item_checklist_tasks', [
                    'notes' => 'Synthetic deadlock holder ' . $task->id,
                ], ['id' => $task->id])->execute();
            }
            self::checkpoint('locked', null);
            $db->createCommand(
                'SELECT * FROM submission_new_resources WHERE id = :id FOR UPDATE',
                [':id' => $request['item_id']]
            )->queryOne();
            $transaction->commit();
            return ['held' => count($tasks)];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    private static function matches($phase, $sql)
    {
        $patterns = [
            'discovered' => '/SELECT\s+submission_id\s+FROM\s+submission_new_resources\s+WHERE\s+id\s*=/i',
            'item_locked' => '/SELECT\s+\*\s+FROM\s+submission_new_resources\s+WHERE\s+id\s*=.*FOR UPDATE/i',
            'faculty_item_deleted' => '/^DELETE FROM `?submission_new_resources`?/i',
        ];
        return isset($patterns[$phase]) && preg_match($patterns[$phase], $sql);
    }

    private static function phaseFor($selector)
    {
        return $selector === 'discovered' ? 'discovered' : 'locked';
    }

    private static function checkpoint($phase, $sql)
    {
        if (self::$paused) {
            return;
        }
        self::$paused = true;
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => self::$request['op'],
            'attempt' => 1,
            'phase' => $phase,
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== $phase) {
            throw new \RuntimeException('Checklist worker received an invalid barrier acknowledgement.');
        }
    }
}

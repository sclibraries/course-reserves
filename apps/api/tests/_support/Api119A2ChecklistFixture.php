<?php

require_once __DIR__ . '/TestSubmissionFixture.php';

/** Synthetic checklist rows shared by the API-119A2 API and concurrency tests. */
class Api119A2ChecklistFixture
{
    private $prefix;
    private $uuids = [];

    public function __construct($prefix)
    {
        $this->prefix = $prefix;
    }

    public function submission($suffix)
    {
        $uuid = self::uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 119-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-11-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $itemId = (int)Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $this->uuids[] = $uuid;
        return ['uuid' => $uuid, 'submission_id' => $submissionId, 'item_id' => $itemId];
    }

    public function template(array $optionalTasks)
    {
        $db = Yii::$app->db;
        $db->createCommand()->insert('checklist_templates', [
            'name' => $this->prefix . 'template-' . bin2hex(random_bytes(4)),
            'format' => 'any',
            'is_active' => 1,
        ])->execute();
        $templateId = (int)$db->getLastInsertID();
        $taskIds = [];
        foreach ($optionalTasks as $index => $optional) {
            $db->createCommand()->insert('checklist_template_tasks', [
                'template_id' => $templateId,
                'label' => $this->prefix . 'task-' . $index,
                'task_order' => $index + 1,
                'optional' => $optional ? 1 : 0,
            ])->execute();
            $taskIds[] = (int)$db->getLastInsertID();
        }
        return ['id' => $templateId, 'task_ids' => $taskIds];
    }

    public function checklist($itemId, array $template)
    {
        $db = Yii::$app->db;
        $db->createCommand()->insert('item_checklists', [
            'submission_item_id' => $itemId,
            'template_id' => $template['id'],
            'assigned_by' => $this->prefix . 'staff',
        ])->execute();
        $checklistId = (int)$db->getLastInsertID();
        $taskIds = [];
        foreach ($template['task_ids'] as $templateTaskId) {
            $db->createCommand()->insert('item_checklist_tasks', [
                'item_checklist_id' => $checklistId,
                'template_task_id' => $templateTaskId,
                'completed' => 0,
            ])->execute();
            $taskIds[] = (int)$db->getLastInsertID();
        }
        return ['id' => $checklistId, 'task_ids' => $taskIds];
    }

    public function expireClaim($itemId)
    {
        Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->prefix . 'staff',
            'claimed_at' => '2026-11-12 12:00:00',
            'last_activity_at' => '2026-11-12 12:00:00',
        ], ['id' => $itemId])->execute();
    }

    public function eventCount($itemId, $eventType)
    {
        return (int)Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = "new" AND item_id = :id AND event_type = :type',
            [':id' => $itemId, ':type' => $eventType]
        )->queryScalar();
    }

    public function writePattern($operation)
    {
        return $operation === 'assign'
            ? '/INSERT INTO `?item_checklists`?/i'
            : '/UPDATE `?item_checklist_tasks`?/i';
    }

    public function assertChecklistLockOrder()
    {
        $locks = array_values(array_filter(Api119A2FailingCommand::queries(), function ($sql) {
            return preg_match('/\b(FOR UPDATE|LOCK IN SHARE MODE)\b|^\s*(INSERT|UPDATE|DELETE)\b/i', $sql);
        }));
        foreach ([
            '/FROM `?faculty_submissions`?.*FOR UPDATE/i',
            '/FROM `?submission_new_resources`?.*FOR UPDATE/i',
            '/FROM `?item_checklists`?.*FOR UPDATE/i',
            '/FROM `?item_checklist_tasks`?.*ORDER BY.*FOR UPDATE/i',
        ] as $index => $pattern) {
            \PHPUnit\Framework\Assert::assertRegExp($pattern, $locks[$index] ?? '');
        }
    }

    public function snapshot($itemId)
    {
        $db = Yii::$app->db;
        $checklistId = $db->createCommand(
            'SELECT id FROM item_checklists WHERE submission_item_id = :id', [':id' => $itemId]
        )->queryScalar();
        return [
            'item' => $db->createCommand('SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $itemId])
                ->queryOne(),
            'checklist' => $checklistId ? $db->createCommand(
                'SELECT * FROM item_checklists WHERE id = :id', [':id' => $checklistId]
            )->queryOne() : null,
            'tasks' => $checklistId ? $db->createCommand(
                'SELECT * FROM item_checklist_tasks WHERE item_checklist_id = :id ORDER BY id', [':id' => $checklistId]
            )->queryAll() : [],
            'events' => $db->createCommand(
                'SELECT * FROM workflow_events WHERE item_kind = "new" AND item_id = :id ORDER BY id',
                [':id' => $itemId]
            )->queryAll(),
        ];
    }

    public function cleanup()
    {
        $db = Yii::$app->db;
        foreach ($this->uuids as $uuid) {
            $submissionId = $db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
                [':uuid' => $uuid]
            )->queryScalar();
            if ($submissionId) {
                $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
                TestSubmissionFixture::delete($uuid);
            }
        }
        $templateIds = $db->createCommand(
            'SELECT id FROM checklist_templates WHERE name LIKE :prefix',
            [':prefix' => $this->prefix . 'template-%']
        )->queryColumn();
        if ($templateIds) {
            $db->createCommand()->delete('checklist_template_tasks', ['template_id' => $templateIds])->execute();
            $db->createCommand()->delete('checklist_templates', ['id' => $templateIds])->execute();
        }
    }

    public static function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

class Api119A2NotifierSpy
{
    public $notifications = [];

    public function notify($eventType, array $context)
    {
        $this->notifications[] = ['event' => $eventType, 'context' => $context];
    }
}

class Api119A2FailingCommand extends \yii\db\Command
{
    private static $pattern;
    private static $remaining = 0;
    private static $matches = 0;
    private static $queries = [];
    private static $deadlock = false;

    public static function clearConfiguration()
    {
        self::$pattern = null;
        self::$remaining = self::$matches = 0;
        self::$queries = [];
        self::$deadlock = false;
    }

    public static function resetQueries()
    {
        self::$queries = [];
    }

    public static function queries()
    {
        return self::$queries;
    }

    public static function failNext($pattern, $count = 1, $deadlock = false)
    {
        self::$pattern = $pattern;
        self::$remaining = $count;
        self::$matches = 0;
        self::$deadlock = $deadlock;
    }

    public static function remaining()
    {
        return self::$remaining;
    }

    public static function matches()
    {
        return self::$matches;
    }

    public function execute()
    {
        self::observe($this->getRawSql());
        return parent::execute();
    }

    protected function queryInternal($method, $fetchMode = null)
    {
        self::observe($this->getRawSql());
        return parent::queryInternal($method, $fetchMode);
    }

    private static function observe($sql)
    {
        self::$queries[] = $sql;
        if (self::$remaining > 0 && preg_match(self::$pattern, $sql)) {
            self::$remaining--;
            self::$matches++;
            if (self::$deadlock) {
                $exception = new \PDOException('Synthetic deadlock.');
                $exception->errorInfo = ['40001', 1213, 'Deadlock found when trying to get lock'];
                throw $exception;
            }
            throw new \RuntimeException('Synthetic persistence failure.');
        }
    }
}

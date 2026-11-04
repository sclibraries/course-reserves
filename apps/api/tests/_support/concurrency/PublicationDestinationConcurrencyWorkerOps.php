<?php

use app\services\PublicationDestinationRestartRequired;

/** Worker-side probes and caller modes; every outcome is returned as data for the parent to assert. */
class PublicationDestinationConcurrencyWorkerOps
{
    private const LOCK_PROBES = [
        'submission' => ['faculty_submissions', 'submission_id'],
        'new_item' => ['submission_new_resources', 'id'],
        'reuse_item' => ['submission_reuse_resources', 'id'],
        'attachment' => ['publication_attachments', 'id'],
        'destination' => ['publication_destinations', 'id'],
        'offering' => ['course_offerings', 'offering_id'],
        'resource' => ['resources', 'resource_id'],
        'course_resource' => ['course_resources', 'course_resource_id'],
        'physical_reference' => ['physical_resource_references', 'reference_id'],
    ];

    public static function mysqlCode(\Throwable $exception)
    {
        return $exception instanceof \yii\db\Exception && isset($exception->errorInfo[1])
            ? (int)$exception->errorInfo[1] : null;
    }

    public static function assertFixtureManifest(array $manifest, $db)
    {
        $checks = [];
        foreach ($manifest['submissions'] ?? [] as $id) {
            $checks[] = ['faculty_submissions', 'submission_id', $id];
        }
        foreach ($manifest['items'] ?? [] as $item) {
            $checks[] = [$item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources', 'id', $item['id']];
        }
        foreach ($manifest['destinations'] ?? [] as $id) {
            $checks[] = ['publication_destinations', 'id', $id];
        }
        foreach ($manifest['pointers'] ?? [] as $pointer) {
            $checks[] = $pointer['kind'] === 'electronic'
                ? ['course_resources', 'course_resource_id', $pointer['id']]
                : ['physical_resource_references', 'reference_id', $pointer['id']];
        }
        foreach ($checks as list($table, $column, $id)) {
            $count = $db->createCommand('SELECT COUNT(*) FROM ' . $table . ' WHERE ' . $column . ' = :id', [':id' => $id])
                ->queryScalar();
            if ((int)$count !== 1) {
                throw new \RuntimeException('Worker could not see committed fixture row ' . $table . ' ' . $id . '.');
            }
        }
    }

    /** A 1 s FOR UPDATE on one row: 'contended' only for exactly 1205, any other error fails the test. */
    public static function lockProbe(array $row, $db)
    {
        if (!isset(self::LOCK_PROBES[$row['kind'] ?? ''])) {
            throw new \RuntimeException('Unsupported lock probe row kind.');
        }
        list($table, $column) = self::LOCK_PROBES[$row['kind']];
        $outcome = self::withShortWait($db, function () use ($db, $table, $column, $row) {
            $db->createCommand('SELECT ' . $column . ' FROM ' . $table . ' WHERE ' . $column . ' = :id FOR UPDATE', [
                ':id' => $row['id'],
            ])->queryScalar();
        });
        return array_merge(['kind' => $row['kind']], $outcome);
    }

    /** A direct (non-compliant) insert with a 1 s wait; it is always rolled back. FK checks are off to isolate the key. */
    public static function insertProbe($table, array $values, $db)
    {
        if (!in_array($table, ['publication_destinations', 'publication_attachments'], true)) {
            throw new \RuntimeException('Unsupported insert probe table.');
        }
        $db->createCommand('SET SESSION FOREIGN_KEY_CHECKS = 0')->execute();
        try {
            $outcome = self::withShortWait($db, function () use ($db, $table, $values) {
                $db->createCommand()->insert($table, $values)->execute();
            });
        } finally {
            $db->createCommand('SET SESSION FOREIGN_KEY_CHECKS = 1')->execute();
        }
        return array_merge(['table' => $table], $outcome);
    }

    /**
     * Runs the registry call inside caller transactions that wrote (or read) first.
     * A RestartRequired is reported with its cause code and the Yii level it left behind.
     */
    public static function nested(callable $call, array $request, $db)
    {
        $read = $request['caller_read'] ?? null;
        for ($level = 1; $level <= (int)$request['nest']; $level++) {
            $db->beginTransaction();
            if (isset($request['caller_write'])) {
                $name = $request['caller_write'] . '-L' . $level;
                $db->createCommand()->insert('courses', ['course_name' => $name, 'course_number' => $name])->execute();
            }
        }
        $readValue = function () use ($db, $read) {
            return $read ? $db->createCommand($read['sql'], $read['params'] ?? [])->queryScalar() : null;
        };
        $before = $readValue();
        try {
            $registry = call_user_func($call);
        } catch (PublicationDestinationRestartRequired $exception) {
            $level = self::level($db);
            while (self::level($db) > 0) {
                $db->getTransaction()->rollBack();
            }
            return [
                'restart_required' => true,
                'cause_code' => $exception->getPrevious() ? self::mysqlCode($exception->getPrevious()) : null,
                'level_at_restart' => $level,
            ];
        }
        $after = $readValue();
        while (self::level($db) > 0) {
            $db->getTransaction()->commit();
        }
        return ['registry' => $registry, 'caller_read_before' => $before, 'caller_read_after' => $after];
    }

    private static function level($db)
    {
        $transaction = $db->getTransaction();
        return $transaction !== null && $transaction->isActive ? $transaction->level : 0;
    }

    private static function withShortWait($db, callable $statement)
    {
        $db->createCommand('SET SESSION innodb_lock_wait_timeout = 1')->execute();
        $transaction = $db->beginTransaction();
        try {
            call_user_func($statement);
            return ['outcome' => 'acquired'];
        } catch (\yii\db\Exception $exception) {
            if (self::mysqlCode($exception) !== 1205) {
                throw new \RuntimeException('Expected probe error 1205, got ' . self::mysqlCode($exception), 0, $exception);
            }
            return ['outcome' => 'contended', 'mysql_code' => 1205];
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            $db->createCommand('SET SESSION innodb_lock_wait_timeout = 10')->execute();
        }
    }
}

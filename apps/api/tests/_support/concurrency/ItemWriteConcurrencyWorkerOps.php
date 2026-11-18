<?php

/** Exercises staged item acquisition with an acknowledged barrier after parent discovery. */
class ItemWriteConcurrencyWorkerOps
{
    private static $request;
    private static $discoveries;
    private static $candidatePaused;

    public static function run(array $request)
    {
        self::$request = $request;
        self::$discoveries = 0;
        self::$candidatePaused = false;
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) {
            self::observe($sql);
        });
        try {
            if (self::$request['op'] === 'item_lock_resource_update') {
                $updated = (new \app\services\ResourceMutationService())->update(
                    self::$request['resource_id'], self::$request['body']
                );
                return ['resource_name' => $updated['resource']->name];
            }

            $reader = new \app\services\ItemWriteLock();
            $locked = \app\services\Transactional::retrying(function () use ($reader) {
                return $reader->lock(self::$request['kind'], self::$request['item_id']);
            });
            return [
                'submission_id' => (int)$locked['submission_id'],
                'submission' => $locked['submission']->getAttributes(),
                'item' => $locked['item']->getAttributes(),
            ];
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }

    private static function observe($sql)
    {
        if (self::$request['op'] === 'item_lock_resource_update' && !self::$candidatePaused
            && preg_match('/SELECT "new" AS kind, item\.id, item\.submission_id FROM submission_new_resources item '
                . 'WHERE item\.source_resource_id =/i', $sql)) {
            self::$candidatePaused = true;
            self::checkpoint('discovered', 0, $sql);
            return;
        }

        if (!preg_match(
            '/SELECT\s+submission_id\s+FROM\s+submission_(?:new|reuse)_resources\s+WHERE\s+id\s*=/i',
            $sql
        )) {
            return;
        }
        self::$discoveries++;
        if (self::$discoveries > (int)(self::$request['pause_attempts'] ?? 0)) {
            return;
        }
        self::checkpoint('discovered', self::$discoveries, $sql);
    }

    private static function checkpoint($phase, $attempt, $sql)
    {
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => self::$request['op'],
            'attempt' => $attempt,
            'phase' => $phase,
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== $phase
            || (int)($answer['attempt'] ?? -1) !== $attempt) {
            throw new \RuntimeException('Item lock worker received an invalid discovery acknowledgement.');
        }
    }
}

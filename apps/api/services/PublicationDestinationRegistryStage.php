<?php

namespace app\services;

/** Runs discovery, ordered locking and current validation for one registry attempt. */
class PublicationDestinationRegistryStage
{
    private $db;
    private $lock;
    private $coverage;
    private $probe;

    public function __construct($db, PublicationDestinationLock $lock, PublicationDestinationProbe $probe)
    {
        $this->db = $db;
        $this->lock = $lock;
        $this->coverage = new PublicationDestinationRegistryCoverage();
        $this->probe = $probe;
    }

    public function run($attempt, callable $collect, callable $apply, ?callable $finish = null)
    {
        $discovered = call_user_func($collect, false, null);
        $required = $this->coverage->fromContext($discovered);
        $this->probe->checkpoint('discovered', $attempt, ['required' => $required]);
        $this->lock->lock($required);
        $this->probe->checkpoint('locked', $attempt, [
            'required' => $required,
            'acquired' => $required,
        ]);

        $guard = function ($bucket, $id) use ($required) {
            $this->coverage->assertContains($required, $bucket, $id);
        };
        $savepoint = 'api116b1_registry_stage';
        $this->db->schema->createSavepoint($savepoint);
        try {
            $current = call_user_func($collect, true, $guard);
        } catch (\Throwable $exception) {
            $this->db->schema->rollBackSavepoint($savepoint);
            throw $exception;
        }
        $currentCoverage = $this->coverage->fromContext($current);
        if (!$this->coverageContains($required, $currentCoverage)) {
            if (!$this->onlyWinnerRowsChanged($required, $currentCoverage)
                || $finish === null || !call_user_func($finish, $current)) {
                $this->db->schema->rollBackSavepoint($savepoint);
                throw new PublicationDestinationRestartRequired('Destination lock coverage changed.');
            }
            $this->db->schema->releaseSavepoint($savepoint);
        } else {
            $this->db->schema->rollBackSavepoint($savepoint);
        }
        return call_user_func($apply, $current, $attempt);
    }

    private function onlyWinnerRowsChanged(array $required, array $current)
    {
        unset($required['destination_ids'], $required['attachment_ids']);
        unset($current['destination_ids'], $current['attachment_ids']);
        return $this->coverageContains($required, $current);
    }

    private function coverageContains(array $coverage, array $current)
    {
        foreach ($current as $bucket => $ids) {
            foreach ($ids as $id) {
                if (!in_array($id, $coverage[$bucket] ?? [], true)) {
                    return false;
                }
            }
        }
        return true;
    }
}

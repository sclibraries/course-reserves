<?php

use app\services\PublicationDestinationLock;

/** Injects a committed unique-key winner from the worker connection at a probe barrier. */
class PublicationDestinationConcurrencyProbeInsert
{
    private $db;
    private $request;
    private $coverage;
    private $inserted = false;

    public function __construct($db, ?array $request)
    {
        $this->db = $db;
        $this->request = $request;
    }

    public function checkpoint($phase, $attempt, array $context = [])
    {
        if ($phase === 'locked' && (int)$attempt === 1) {
            $this->coverage = $context['required'] ?? null;
        }
        $insertPhase = $this->request['phase'] ?? 'before_insert';
        if ($this->request && !$this->inserted && $phase === $insertPhase
            && (int)$attempt === 1 && (!isset($context['table'])
                || $context['table'] === ($this->request['table'] ?? null))) {
            $transaction = $this->db->getTransaction();
            if ($transaction === null || !$transaction->isActive || !is_array($this->coverage)) {
                throw new \RuntimeException('Probe insert requires an active locked attempt.');
            }

            $transaction->commit();
            $id = $this->insertRow();
            $this->db->beginTransaction();
            (new PublicationDestinationLock(null, $this->db))->lock($this->coverage);
            $this->inserted = true;
            return ['injected_id' => $id];
        }
        if ($this->inserted && $phase === 'recovery_entered' && (int)$attempt === 1) {
            $transaction = $this->db->getTransaction();
            if ($transaction !== null && $transaction->isActive) {
                $transaction->rollBack();
            }
        }
        return [];
    }

    private function insertRow()
    {
        $table = $this->request['table'] ?? '';
        if (!in_array($table, ['publication_destinations', 'publication_attachments'], true)) {
            throw new \RuntimeException('Unsupported probe insert table.');
        }

        $this->db->createCommand()->insert($table, $this->request['values'] ?? [])->execute();
        return (int)$this->db->getLastInsertID();
    }
}

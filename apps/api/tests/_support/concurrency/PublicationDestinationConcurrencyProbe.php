<?php

require_once __DIR__ . '/PublicationDestinationConcurrencyWire.php';

use app\services\PublicationDestinationProbe;

/** Pipe-backed phase barrier injected into a worker's real registry; 'abort' makes the operation throw. */
class PublicationDestinationConcurrencyProbe implements PublicationDestinationProbe
{
    private $operation;
    private $onCheckpoint;

    public function __construct($operation, ?callable $onCheckpoint = null)
    {
        $this->operation = $operation;
        $this->onCheckpoint = $onCheckpoint;
    }

    public function checkpoint($phase, $attempt, array $context = [])
    {
        $hookContext = [];
        if ($this->onCheckpoint !== null) {
            $hookContext = call_user_func($this->onCheckpoint, $phase, $attempt, $context);
            if (is_array($hookContext)) {
                $context = array_merge($context, $hookContext);
            }
        }
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => $this->operation,
            'attempt' => (int)$attempt,
            'phase' => $phase,
            'context' => $context,
        ]);

        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) === 'abort') {
            throw new \RuntimeException('Concurrency worker aborted by test at ' . $phase . '.');
        }
        if (($answer['command'] ?? null) !== 'go'
            || ($answer['phase'] ?? null) !== $phase
            || (int)($answer['attempt'] ?? -1) !== (int)$attempt) {
            throw new \RuntimeException('Unexpected concurrency phase acknowledgement.');
        }
    }
}

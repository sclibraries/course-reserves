<?php

use app\services\PublicationDestinationProbe;

/** Records real registry checkpoints without replacing any database operation. */
class PublicationDestinationConcurrencyRecordingProbe implements PublicationDestinationProbe
{
    public $events = [];

    public function checkpoint($phase, $attempt, array $context = [])
    {
        $this->events[] = [
            'phase' => $phase,
            'attempt' => (int)$attempt,
            'context' => $context,
        ];
    }
}

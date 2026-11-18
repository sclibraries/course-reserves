<?php

namespace app\services;

/** Provides claim history reads through the shared linked-item boundary. */
class ItemClaimReadService
{
    use ServiceResult;

    private $linkedItems;
    private $eventLog;

    public function __construct($linkedItems, $eventLog)
    {
        $this->linkedItems = $linkedItems;
        $this->eventLog = $eventLog;
    }

    public function timeline($kind, $id)
    {
        return $this->linkedItems->withLinkedItem($kind, $id, function () use ($kind, $id) {
            return $this->result(200, ['items' => $this->eventLog->itemTimeline($kind, $id)]);
        });
    }
}

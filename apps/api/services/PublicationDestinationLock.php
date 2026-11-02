<?php

namespace app\services;

/** API-116A test-round stub for the destination writer lock helper. */
class PublicationDestinationLock
{
    private $selectForUpdate;

    public function __construct(?callable $selectForUpdate = null)
    {
        $this->selectForUpdate = $selectForUpdate;
    }

    public function lock(array $affectedIds)
    {
        throw new \RuntimeException('not implemented');
    }
}

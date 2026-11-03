<?php

namespace app\services;

/** Stub for registry-only transaction ownership and bounded closure restarts. */
class PublicationDestinationTransaction
{
    public static function run(callable $callback, ?PublicationDestinationProbe $probe = null)
    {
        throw new \LogicException('not implemented');
    }
}

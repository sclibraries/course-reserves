<?php

namespace app\services;

/** Test-round contract stub; API-118's build round supplies the implementation. */
class SourceResourceId
{
    public static function canonical($value): ?int
    {
        throw new \LogicException('not implemented');
    }

    public static function sqlValue($expression): string
    {
        throw new \LogicException('not implemented');
    }
}

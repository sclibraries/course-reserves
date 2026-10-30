<?php

namespace app\services;

/** Resolves physical-reference identity from evidence attached to one submission item. */
class PhysicalResourceReferenceIdentity
{
    /**
     * @param string $kind
     * @param array $item
     * @return array
     */
    public function resolve($kind, array $item)
    {
        throw new \RuntimeException('not implemented');
    }
}

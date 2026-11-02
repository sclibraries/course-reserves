<?php

namespace app\services;

/** API-116A test-round stub; replaced by the registry implementation in the build round. */
class PublicationDestinationRegistry
{
    public function registerOwned(array $item, array $destination)
    {
        throw new \RuntimeException('not implemented');
    }

    public function attach(array $item, $destinationId)
    {
        throw new \RuntimeException('not implemented');
    }

    public function release(array $item)
    {
        throw new \RuntimeException('not implemented');
    }

    public function retire($destinationId)
    {
        throw new \RuntimeException('not implemented');
    }

    public function detach(array $item)
    {
        throw new \RuntimeException('not implemented');
    }

    public function follow($destinationId, array $newPointer)
    {
        throw new \RuntimeException('not implemented');
    }

    public function read($destinationId)
    {
        throw new \RuntimeException('not implemented');
    }
}

<?php

namespace app\services;

/** Production default: destination operations do not wait at test barriers. */
class NullPublicationDestinationProbe implements PublicationDestinationProbe
{
    public function checkpoint($phase, $attempt, array $context = [])
    {
    }
}

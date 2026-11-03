<?php

namespace app\services;

/** Test seam for observing the ordered stages of a destination operation. */
interface PublicationDestinationProbe
{
    public function checkpoint($phase, $attempt, array $context = []);
}

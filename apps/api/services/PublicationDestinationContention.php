<?php

namespace app\services;

/** Raised after a registry-owned transaction exhausts its bounded restarts. */
class PublicationDestinationContention extends \RuntimeException
{
    public $errorCode = 'destination_contention';
}

<?php

namespace app\services;

/**
 * Raised by a registry call nested in a caller's transaction after a deadlock, lock wait timeout or registry-key
 * duplicate. The caller's transaction has already been rolled back to level 0; the previous exception keeps the
 * original MySQL error, so an outer caller retries only what it may.
 */
class PublicationDestinationRestartRequired extends \RuntimeException
{
}

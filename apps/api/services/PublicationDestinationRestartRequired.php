<?php

namespace app\services;

/** Signals that the acquired destination lock set no longer covers the operation. */
class PublicationDestinationRestartRequired extends \RuntimeException
{
}

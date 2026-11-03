<?php

/** One JSON object per line on the worker control pipes. */
class PublicationDestinationConcurrencyWire
{
    public static function write($stream, array $frame)
    {
        $json = json_encode($frame, JSON_UNESCAPED_SLASHES);
        if ($json === false || fwrite($stream, $json . "\n") === false) {
            throw new \RuntimeException('Could not write a concurrency protocol frame.');
        }
        fflush($stream);
    }

    public static function read($stream)
    {
        $line = fgets($stream);
        if ($line === false) {
            throw new \RuntimeException('Unexpected EOF on a concurrency protocol pipe.');
        }
        $frame = json_decode($line, true);
        if (!is_array($frame) || json_last_error() !== JSON_ERROR_NONE) {
            throw new \RuntimeException('Malformed concurrency protocol JSON.');
        }
        return $frame;
    }
}

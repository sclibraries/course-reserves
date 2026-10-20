<?php

namespace app\components;

/** Normalizes browser-accepted resource links before API validation and storage. */
class ResourceUrl
{
    public static function normalize($url)
    {
        if (!is_string($url)) {
            return null;
        }

        $url = trim($url);
        $normalized = preg_replace_callback(
            '/%(?![0-9A-Fa-f]{2})|[^A-Za-z0-9._~:\/?#\[\]@!$&\'()*+,;=%-]/',
            function ($matches) {
                return rawurlencode($matches[0]);
            },
            $url
        );
        $parts = parse_url($normalized);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host']) ||
            !in_array(strtolower($parts['scheme']), ['http', 'https'], true) ||
            filter_var($normalized, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        return $normalized;
    }
}

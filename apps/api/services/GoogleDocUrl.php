<?php

namespace app\services;

/** Parses only canonical Google Docs URLs and derives the outbound URLs from their IDs. */
class GoogleDocUrl
{
    public static function documentId($url)
    {
        if (!self::isSafeUrl($url, ['docs.google.com'])) {
            return null;
        }
        $parts = parse_url(trim($url));
        if (!preg_match('~^/document/d/([A-Za-z0-9_-]{10,128})(?:/[^?#]*)?/?$~', $parts['path'] ?? '', $match)) {
            return null;
        }
        return $match[1];
    }

    public static function isSafeUrl($url, $allowedHosts)
    {
        if (!is_string($url)) {
            return false;
        }
        $parts = parse_url(trim($url));
        if (!$parts || strtolower($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) ||
            isset($parts['user']) || isset($parts['pass']) ||
            (isset($parts['port']) && (int)$parts['port'] !== 443)) {
            return false;
        }

        $host = strtolower($parts['host']);
        if (is_callable($allowedHosts)) {
            return (bool)call_user_func($allowedHosts, $host);
        }
        if (!is_array($allowedHosts)) {
            return false;
        }
        return in_array($host, array_map('strtolower', $allowedHosts), true);
    }

    public static function isDocumentId($documentId)
    {
        return is_string($documentId) && preg_match('/^[A-Za-z0-9_-]{10,128}$/', $documentId) === 1;
    }

    public static function sourceUrl($documentId)
    {
        return 'https://docs.google.com/document/d/' . $documentId . '/edit';
    }

    public static function exportUrl($baseUrl, $documentId)
    {
        return rtrim($baseUrl, '/') . '/document/d/' . rawurlencode($documentId) . '/export?format=txt';
    }
}

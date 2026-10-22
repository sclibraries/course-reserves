<?php

namespace app\services;

/** Parses only canonical Google Docs URLs and derives the outbound URLs from their IDs. */
class GoogleDocUrl
{
    public static function documentId($url)
    {
        if (!is_string($url)) {
            return null;
        }
        $parts = parse_url(trim($url));
        if (!$parts || strtolower($parts['scheme'] ?? '') !== 'https' ||
            strtolower($parts['host'] ?? '') !== 'docs.google.com' ||
            isset($parts['user']) || isset($parts['pass']) ||
            (isset($parts['port']) && (int)$parts['port'] !== 443)) {
            return null;
        }
        if (!preg_match('~^/document/d/([A-Za-z0-9_-]{10,128})(?:/[^?#]*)?/?$~', $parts['path'] ?? '', $match)) {
            return null;
        }
        return $match[1];
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

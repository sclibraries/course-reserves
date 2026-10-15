<?php

namespace app\services;

class SafeRedirect
{
    public static function resolve(
        $target,
        $facultyFormUrl,
        array $corsOrigins,
        $requestScheme,
        $requestHost,
        $defaultRedirect
    ) {
        if (!is_string($target) || $target === '' || self::hasUnsafeCharacters($target)) {
            return $defaultRedirect;
        }

        $targetOrigin = self::originParts($target);
        if ($targetOrigin !== null) {
            $allowedOrigins = $corsOrigins;
            if (is_string($facultyFormUrl) && $facultyFormUrl !== '') {
                $allowedOrigins[] = $facultyFormUrl;
            }

            $allowLocalOrigins = self::isLocalHost($requestHost);
            foreach ($allowedOrigins as $allowedOrigin) {
                $allowedParts = self::originParts($allowedOrigin);
                if ($allowedParts === null) {
                    continue;
                }
                if (!$allowLocalOrigins && self::isLocalHostname($allowedParts['host'])) {
                    continue;
                }
                if ($targetOrigin === $allowedParts) {
                    return $target;
                }
            }

            return $defaultRedirect;
        }

        if ($target[0] !== '/' || (isset($target[1]) && $target[1] === '/')) {
            return $defaultRedirect;
        }

        $currentOrigin = self::currentOrigin($requestScheme, $requestHost);
        if ($currentOrigin === null) {
            return $defaultRedirect;
        }

        return $currentOrigin . $target;
    }

    public static function isLocalHost($requestHost)
    {
        $origin = self::originParts('http://' . $requestHost);

        return $origin !== null && self::isLocalHostname($origin['host']);
    }

    private static function currentOrigin($requestScheme, $requestHost)
    {
        if (!is_string($requestScheme) || !is_string($requestHost)) {
            return null;
        }

        $origin = self::originParts($requestScheme . '://' . $requestHost);
        if ($origin === null) {
            return null;
        }

        $host = $origin['host'];
        if (strpos($host, ':') !== false && $host[0] !== '[') {
            $host = '[' . $host . ']';
        }

        return $origin['scheme'] . '://' . $host
            . ($origin['port'] === null ? '' : ':' . $origin['port']);
    }

    private static function originParts($url)
    {
        if (!is_string($url) || $url === '' || self::hasUnsafeCharacters($url)) {
            return null;
        }

        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }
        if (array_key_exists('user', $parts) || array_key_exists('pass', $parts)) {
            return null;
        }

        $scheme = strtolower($parts['scheme']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $port = isset($parts['port']) ? (int)$parts['port'] : null;
        if ($port !== null && ($port < 1 || $port > 65535)) {
            return null;
        }

        return [
            'scheme' => $scheme,
            'host' => strtolower($parts['host']),
            'port' => $port,
        ];
    }

    private static function isLocalHostname($host)
    {
        return in_array(trim(strtolower($host), '[]'), ['localhost', '127.0.0.1', '::1'], true);
    }

    private static function hasUnsafeCharacters($value)
    {
        return strpos($value, '\\') !== false || preg_match('/[\x00-\x1F\x7F]/', $value) === 1;
    }
}

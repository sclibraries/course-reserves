<?php

namespace app\services;

/** Fetches a Google Doc text export while validating each redirect before requesting it. */
class GoogleDocFetcher implements GoogleDocFetcherInterface
{
    private $baseUrl;
    private $request;

    public function __construct($baseUrl, $request = null)
    {
        $this->baseUrl = rtrim((string)$baseUrl, '/');
        $this->request = $request ?: function ($url, $timeout) {
            return $this->sendRequest($url, $timeout);
        };
    }

    public function fetch($documentId)
    {
        if (!GoogleDocUrl::isDocumentId($documentId)) {
            return $this->failure('invalid_document_id');
        }

        $url = GoogleDocUrl::exportUrl($this->baseUrl, $documentId);
        if (!$this->isInitialUrl($url)) {
            return $this->failure('invalid_base_url');
        }

        for ($redirects = 0; ; $redirects++) {
            try {
                $response = call_user_func($this->request, $url, 10);
            } catch (\Exception $error) {
                return $this->failure('request_failed', $error->getMessage());
            }
            if (!is_array($response)) {
                return $this->failure('invalid_response');
            }

            $headers = $this->normalizeHeaders($response['headers'] ?? []);
            $status = (int)($response['status'] ?? 0);
            if ($status < 300 || $status >= 400) {
                return [
                    'status' => $status,
                    'headers' => $headers,
                    'body' => substr(
                        (string)($response['body'] ?? ''),
                        0,
                        SyllabusUploadValidator::MAX_EXTRACTED_TEXT_BYTES + 1
                    ),
                    'error' => $response['error'] ?? null,
                ];
            }

            if ($redirects >= 3 || empty($headers['location'])) {
                return $this->failure('redirect_limit_exceeded');
            }
            $url = $this->resolveUrl($url, $headers['location']);
            if (!$this->isAllowedRedirectUrl($url)) {
                return $this->failure('redirect_host_not_allowed');
            }
        }
    }

    public static function isAllowedRedirectUrl($url)
    {
        $parts = parse_url($url);
        if (!$parts || strtolower($parts['scheme'] ?? '') !== 'https' ||
            isset($parts['user']) || isset($parts['pass']) ||
            (isset($parts['port']) && (int)$parts['port'] !== 443)) {
            return false;
        }

        $host = strtolower($parts['host'] ?? '');
        return $host === 'docs.google.com' || preg_match('/\.googleusercontent\.com$/', $host) === 1;
    }

    private function isInitialUrl($url)
    {
        $parts = parse_url($url);
        return $parts && strtolower($parts['scheme'] ?? '') === 'https' &&
            strtolower($parts['host'] ?? '') === 'docs.google.com' &&
            !isset($parts['user']) && !isset($parts['pass']) &&
            (!isset($parts['port']) || (int)$parts['port'] === 443);
    }

    private function resolveUrl($currentUrl, $location)
    {
        $location = trim((string)$location);
        if (preg_match('#^https?://#i', $location)) {
            return $location;
        }
        $current = parse_url($currentUrl);
        $origin = 'https://' . $current['host'] .
            (isset($current['port']) ? ':' . $current['port'] : '');
        if (substr($location, 0, 2) === '//') {
            return 'https:' . $location;
        }
        if (substr($location, 0, 1) === '/') {
            return $origin . $location;
        }
        $path = $current['path'] ?? '/';
        $directory = substr($path, 0, strrpos($path, '/') + 1);
        return $origin . $directory . $location;
    }

    private function normalizeHeaders(array $headers)
    {
        $normalized = [];
        foreach ($headers as $name => $value) {
            $normalized[strtolower($name)] = $value;
        }
        return $normalized;
    }

    private function sendRequest($url, $timeout)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => $timeout,
                'follow_location' => 0,
                'ignore_errors' => true,
                'header' => "Accept: text/plain\r\n",
            ],
        ]);
        $body = @file_get_contents(
            $url,
            false,
            $context,
            0,
            SyllabusUploadValidator::MAX_EXTRACTED_TEXT_BYTES + 1
        );
        $lastError = $body === false ? error_get_last() : null;
        $responseHeaders = $http_response_header ?? [];
        $status = 0;
        $headers = [];
        foreach ($responseHeaders as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $match)) {
                $status = (int)$match[1];
                $headers = [];
            } elseif (strpos($header, ':') !== false) {
                list($name, $value) = explode(':', $header, 2);
                $headers[strtolower(trim($name))] = trim($value);
            }
        }
        return [
            'status' => $status,
            'headers' => $headers,
            'body' => $body === false ? '' : $body,
            'error' => $body === false ? 'request_failed' : null,
            'detail' => $lastError['message'] ?? null,
        ];
    }

    private function failure($error, $detail = null)
    {
        return ['status' => 0, 'headers' => [], 'body' => '', 'error' => $error, 'detail' => $detail];
    }
}

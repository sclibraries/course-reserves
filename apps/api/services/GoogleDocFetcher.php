<?php

namespace app\services;

use yii\httpclient\Client;

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
        if (!GoogleDocUrl::isSafeUrl($url, ['docs.google.com'])) {
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
        return GoogleDocUrl::isSafeUrl($url, function ($host) {
            return $host === 'docs.google.com' || preg_match('/\.googleusercontent\.com$/', $host) === 1;
        });
    }

    private function resolveUrl($currentUrl, $location)
    {
        $location = trim((string)$location);
        $reference = parse_url($location);
        if ($reference === false) {
            return '';
        }
        if (isset($reference['scheme'])) {
            return $location;
        }
        $current = parse_url($currentUrl);
        if (isset($reference['host'])) {
            return $current['scheme'] . ':' . $location;
        }
        $path = $reference['path'] ?? '';
        if ($path === '') {
            $path = $current['path'] ?? '/';
            $query = array_key_exists('query', $reference) ? $reference['query'] : ($current['query'] ?? null);
        } else {
            if (substr($path, 0, 1) !== '/') {
                $currentPath = $current['path'] ?? '/';
                $path = substr($currentPath, 0, strrpos($currentPath, '/') + 1) . $path;
            }
            $path = $this->removeDotSegments($path);
            $query = $reference['query'] ?? null;
        }
        $origin = $current['scheme'] . '://' . $current['host'] .
            (isset($current['port']) ? ':' . $current['port'] : '');
        return $origin . $path . ($query === null ? '' : '?' . $query) .
            (isset($reference['fragment']) ? '#' . $reference['fragment'] : '');
    }

    private function removeDotSegments($path)
    {
        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);
            } else {
                $segments[] = $segment;
            }
        }
        $normalized = '/' . implode('/', $segments);
        return substr($path, -1) === '/' || substr($path, -2) === '/.' || substr($path, -3) === '/..'
            ? rtrim($normalized, '/') . '/'
            : $normalized;
    }

    private function normalizeHeaders(array $headers)
    {
        $normalized = [];
        foreach ($headers as $name => $value) {
            $normalized[strtolower($name)] = is_array($value) ? end($value) : $value;
        }
        return $normalized;
    }

    private function sendRequest($url, $timeout)
    {
        $body = '';
        $bodyExceededLimit = false;
        $maxBytes = SyllabusUploadValidator::MAX_EXTRACTED_TEXT_BYTES + 1;
        $request = (new Client(['transport' => 'yii\\httpclient\\CurlTransport']))
            ->createRequest()
            ->setMethod('GET')
            ->setUrl($url)
            ->setOptions([
                'timeout' => $timeout,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_WRITEFUNCTION => function ($resource, $chunk) use (&$body, &$bodyExceededLimit, $maxBytes) {
                    $remaining = $maxBytes - strlen($body);
                    if (strlen($chunk) > $remaining) {
                        $body .= substr($chunk, 0, $remaining);
                        $bodyExceededLimit = true;
                        return 0;
                    }
                    $body .= $chunk;
                    return strlen($chunk);
                },
            ])
            ->addHeaders(['Accept' => 'text/plain']);
        try {
            $response = $request->send();
        } catch (\yii\httpclient\Exception $error) {
            if ($bodyExceededLimit) {
                return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'body_too_large'];
            }
            throw $error;
        }
        return [
            'status' => (int)$response->getStatusCode(),
            'headers' => $response->getHeaders()->toArray(),
            'body' => $body,
            'error' => null,
        ];
    }

    private function failure($error, $detail = null)
    {
        return ['status' => 0, 'headers' => [], 'body' => '', 'error' => $error, 'detail' => $detail];
    }
}

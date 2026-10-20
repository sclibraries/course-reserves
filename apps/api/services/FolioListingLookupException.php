<?php

namespace app\services;

class FolioListingLookupException extends \RuntimeException
{
    private $result;

    private function __construct($status, array $body)
    {
        parent::__construct($body['error_code']);
        $this->result = ['status' => $status, 'body' => $body];
    }

    public static function notFound()
    {
        return new self(404, ['error_code' => 'folio_listing_not_found']);
    }

    public static function unavailable($reference)
    {
        return new self(502, [
            'error_code' => 'folio_unavailable',
            'message' => "FOLIO isn't responding. Try again in a moment.",
            'reference' => $reference,
        ]);
    }

    public function getResult()
    {
        return $this->result;
    }
}

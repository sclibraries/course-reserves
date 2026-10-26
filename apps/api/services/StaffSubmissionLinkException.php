<?php

namespace app\services;

class StaffSubmissionLinkException extends \RuntimeException
{
    private $statusCode;
    private $errorCode;

    public function __construct($statusCode, $errorCode)
    {
        parent::__construct('The course listing could not be linked.');
        $this->statusCode = (int)$statusCode;
        $this->errorCode = $errorCode;
    }

    public function getStatusCode()
    {
        return $this->statusCode;
    }

    public function getErrorCode()
    {
        return $this->errorCode;
    }
}

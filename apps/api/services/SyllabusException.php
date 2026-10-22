<?php

namespace app\services;

use RuntimeException;

class SyllabusException extends RuntimeException
{
    private $errorCode;
    private $statusCode;
    private $referenceId;

    public function __construct($message, $errorCode, $statusCode, $referenceId = null, $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->errorCode = $errorCode;
        $this->statusCode = (int)$statusCode;
        $this->referenceId = $referenceId;
    }

    public function getErrorCode()
    {
        return $this->errorCode;
    }

    public function getStatusCode()
    {
        return $this->statusCode;
    }

    public function getReferenceId()
    {
        return $this->referenceId;
    }

    public function toResponse()
    {
        $response = ['error' => $this->getMessage(), 'error_code' => $this->errorCode];
        if ($this->referenceId !== null) {
            $response['reference_id'] = $this->referenceId;
        }
        return $response;
    }
}

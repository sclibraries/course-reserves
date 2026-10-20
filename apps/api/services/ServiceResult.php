<?php

namespace app\services;

trait ServiceResult
{
    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }
}

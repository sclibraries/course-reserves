<?php

namespace app\services;

class ItemContention extends \yii\web\HttpException
{
    public $reference;

    public function __construct($reference, \Throwable $previous = null)
    {
        $this->reference = $reference;
        parent::__construct(409, 'The item could not be updated because it is being changed.', 0, $previous);
    }
}

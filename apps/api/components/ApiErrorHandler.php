<?php

namespace app\components;

use Yii;
use app\services\ItemContention;
use yii\web\ErrorHandler;
use yii\web\Response;

class ApiErrorHandler extends ErrorHandler
{
    protected function renderException($exception)
    {
        if (!($exception instanceof ItemContention)) {
            parent::renderException($exception);
            return;
        }

        $response = Yii::$app->getResponse();
        $response->isSent = false;
        $response->stream = null;
        $response->data = null;
        $response->content = null;
        $response->setStatusCode(409);
        $response->format = Response::FORMAT_JSON;
        $response->data = [
            'error_code' => 'item_contention',
            'reference' => $exception->reference,
        ];
        $response->send();
    }
}

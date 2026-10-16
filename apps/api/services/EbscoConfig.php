<?php

namespace app\services;

use Yii;
use yii\httpclient\Client;

class EbscoConfig
{
    public static function assertConfigured()
    {
        $settings = isset(Yii::$app->params['ebsco']) ? Yii::$app->params['ebsco'] : [];
        $requiredSettings = [
            'userId' => 'EBSCO_USER_ID',
            'password' => 'EBSCO_PASSWORD',
            'edsProfile' => 'EBSCO_PROFILE',
        ];

        foreach ($requiredSettings as $key => $settingName) {
            if (!isset($settings[$key]) || trim((string)$settings[$key]) === '') {
                throw new \RuntimeException('Missing EBSCO setting: ' . $settingName);
            }
        }
    }

    public static function createClient()
    {
        return Yii::createObject(Client::class);
    }
}

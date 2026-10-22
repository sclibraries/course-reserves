<?php

return [
    'definitions' => [
        \app\services\GoogleDocFetcherInterface::class => function ($container) {
            return new \app\services\GoogleDocFetcher(\Yii::$app->params['googleDocBaseUrl']);
        },
        \app\services\SyllabusStore::class => function ($container) {
            $settings = \Yii::$app->params['syllabus'];
            return new \app\services\SyllabusStore(
                $container->get(\app\services\GoogleDocFetcherInterface::class),
                $settings['storagePath'],
                $settings['maxUploadBytes']
            );
        },
    ],
];

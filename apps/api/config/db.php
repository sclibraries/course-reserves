<?php

// Environment variables are injected by Docker Compose.
$dbHost = getenv('DB_HOST') ?: $_SERVER['DB_HOST'] ?? 'localhost';
$dbName = getenv('DB_NAME') ?: $_SERVER['DB_NAME'] ?? 'reserves';
$dbUser = getenv('DB_USER');
$dbPass = getenv('DB_PASS');

return [
    'class' => 'yii\db\Connection',
    'dsn' => "mysql:host={$dbHost};dbname={$dbName}",
    'username' => $dbUser,
    'password' => $dbPass,
    'charset' => 'utf8',
    // Schema cache options (for production environment)
    //'enableSchemaCache' => true,
    //'schemaCacheDuration' => 60,
    //'schemaCache' => 'cache',
];

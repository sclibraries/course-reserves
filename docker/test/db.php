<?php

// Mounted over both DB configs only in the isolated test container.
if (getenv('DB_HOST') !== 'db' || getenv('DB_NAME') !== 'reserves_test') {
    throw new RuntimeException('Refusing database access outside the isolated test schema.');
}

return [
    'class' => 'yii\db\Connection',
    'dsn' => 'mysql:host=db;dbname=reserves_test',
    'username' => getenv('DB_USER'),
    'password' => getenv('DB_PASS'),
    'charset' => 'utf8',
];

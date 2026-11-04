<?php

require_once __DIR__ . '/PublicationDestinationConcurrencyWire.php';

use app\services\PublicationDestinationRegistry;
use yii\helpers\ArrayHelper;

ini_set('display_errors', '0');
error_reporting(E_ALL);

$apiRoot = dirname(__DIR__, 3);
if (getenv('API_TEST_DEPRECATIONS') === '1') {
    putenv('API_TEST_DEPRECATIONS_CHILD=1');
    require_once $apiRoot . '/tests/_support/deprecation-handler.php';
}

define('YII_ENV', 'test');
require_once $apiRoot . '/config/environment.php';
require_once $apiRoot . '/vendor/autoload.php';
require_once $apiRoot . '/vendor/yiisoft/yii2/Yii.php';
\Yii::setAlias('@app', $apiRoot);
require_once __DIR__ . '/PublicationDestinationConcurrencyProbe.php';
require_once __DIR__ . '/PublicationDestinationConcurrencyCommand.php';
require_once __DIR__ . '/PublicationDestinationConcurrencyWorkerOps.php';

$testDbConfig = require $apiRoot . '/config/test_db.php';
$testDbConfig['commandClass'] = PublicationDestinationConcurrencyCommand::class;
$config = ArrayHelper::merge(
    require $apiRoot . '/config/console.php',
    ['components' => ['db' => $testDbConfig]]
);
$application = new \yii\console\Application($config);
$db = \Yii::$app->db;
$db->open();
$db->createCommand('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')->execute();
$db->createCommand('SET SESSION innodb_lock_wait_timeout = 10')->execute();

PublicationDestinationConcurrencyCommand::resetQueries();

$request = PublicationDestinationConcurrencyWire::read(STDIN);
$operation = $request['op'] ?? '';
$sessionTimestamp = $request['session_timestamp'] ?? null;
if ($sessionTimestamp !== null) {
    if (!is_numeric($sessionTimestamp) || (string)(int)$sessionTimestamp !== (string)$sessionTimestamp) {
        throw new \RuntimeException('session_timestamp must be an integer Unix timestamp.');
    }
    $db->createCommand('SET timestamp = ' . (int)$sessionTimestamp)->execute();
}
$identity = $db->createCommand(
    'SELECT CONNECTION_ID() AS connection_id, DATABASE() AS database_name, @@tx_isolation AS isolation_level, '
    . 'CURRENT_TIMESTAMP AS session_time'
)->queryOne();
$attempt = 0;

/** Reports the final frame; the exit code alone never counts as a result. */
function finishConcurrencyWorker($operation, $attempt, array $frame)
{
    PublicationDestinationConcurrencyWire::write(STDOUT, array_merge([
        'op' => $operation,
        'attempt' => $attempt,
        'phase' => 'result',
        'queries' => PublicationDestinationConcurrencyCommand::queries(),
    ], $frame));
    exit(empty($frame['ok']) ? 1 : 0);
}

function failureFrame(\Throwable $exception)
{
    return [
        'ok' => false,
        'error' => get_class($exception) . ': ' . $exception->getMessage(),
        'mysql_code' => PublicationDestinationConcurrencyWorkerOps::mysqlCode($exception),
    ];
}

try {
    if (!is_string($operation) || $operation === '') {
        throw new \RuntimeException('Worker request must include an operation.');
    }
    if ($operation === 'harness_malformed') {
        fwrite(STDOUT, "not-json\n");
        fflush(STDOUT);
        exit(0);
    }

    PublicationDestinationConcurrencyWire::write(STDOUT, [
        'op' => $operation,
        'attempt' => 0,
        'phase' => 'ready',
        'connection_id' => (int)$identity['connection_id'],
        'database' => $identity['database_name'],
        'isolation_level' => strtoupper($identity['isolation_level']),
        'lock_wait_timeout' => 10,
        'session_time' => $identity['session_time'],
    ]);
    $ready = PublicationDestinationConcurrencyWire::read(STDIN);
    if (($ready['command'] ?? null) !== 'go' || ($ready['phase'] ?? null) !== 'ready'
        || (int)($ready['attempt'] ?? -1) !== 0) {
        throw new \RuntimeException('Worker did not receive the ready acknowledgement.');
    }
    if ($operation === 'harness_eof') {
        exit(0);
    }
    if ($operation === 'harness_stall') {
        PublicationDestinationConcurrencyWire::read(STDIN);
        exit(0);
    }
} catch (\Throwable $exception) {
    finishConcurrencyWorker($operation, $attempt, failureFrame($exception));
}

function runConcurrencyOperation($operation, array $request, $db, &$attempt)
{
    if ($operation === 'preflight') {
        return ['round_trip' => true];
    }
    if ($operation === 'lock_probe') {
        return PublicationDestinationConcurrencyWorkerOps::lockProbe($request['row'], $db);
    }
    if ($operation === 'insert_probe') {
        return PublicationDestinationConcurrencyWorkerOps::insertProbe($request['table'], $request['values'], $db);
    }

    PublicationDestinationConcurrencyWorkerOps::assertFixtureManifest($request['manifest'] ?? [], $db);
    $depth = (int)($request['nest'] ?? 0);
    $calls = 0;
    $probe = new PublicationDestinationConcurrencyProbe($operation, function ($phase, $value) use (&$attempt, &$calls, $depth) {
        $attempt = (int)$value;
        $context = ['query_offset' => count(PublicationDestinationConcurrencyCommand::queries())];
        if ($phase === 'attempt_started') {
            $calls += $attempt === 1 ? 1 : 0;
            $context += ['call_id' => $calls, 'depth' => $depth];
        }
        return $context;
    });
    $registry = new PublicationDestinationRegistry($db, null, null, $probe);
    $item = $request['item'] ?? [];
    $operations = [
        'register_owned' => function () use ($registry, $item, $request) {
            return $registry->registerOwned($item, $request['pointer']);
        },
        'attach_by_id' => function () use ($registry, $item, $request) {
            return $registry->attach($item, (int)$request['destination_id']);
        },
        'attach_by_pointer' => function () use ($registry, $item, $request) {
            return $registry->attach($item, $request['pointer']);
        },
        'release' => function () use ($registry, $item) {
            return $registry->release($item);
        },
        'retire' => function () use ($registry, $request) {
            return $registry->retire((int)$request['destination_id']);
        },
        'detach' => function () use ($registry, $item) {
            return $registry->detach($item);
        },
        'follow' => function () use ($registry, $request) {
            return $registry->follow((int)$request['destination_id'], $request['pointer']);
        },
    ];
    if (!isset($operations[$operation])) {
        throw new \RuntimeException('Unknown concurrency worker operation: ' . $operation);
    }
    $result = $depth > 0
        ? PublicationDestinationConcurrencyWorkerOps::nested($operations[$operation], $request, $db)
        : call_user_func($operations[$operation]);
    return json_decode(json_encode($result, JSON_UNESCAPED_SLASHES), true);
}

try {
    $result = runConcurrencyOperation($operation, $request, $db, $attempt);
    finishConcurrencyWorker($operation, $attempt, ['ok' => true, 'result' => $result]);
} catch (\Throwable $exception) {
    finishConcurrencyWorker($operation, $attempt, failureFrame($exception));
}

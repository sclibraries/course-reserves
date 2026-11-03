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
$queries = [];

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
        'isolation_level' => strtoupper(str_replace('-', '-', $identity['isolation_level'])),
        'lock_wait_timeout' => 10,
        'session_time' => $identity['session_time'],
    ]);
    $ready = PublicationDestinationConcurrencyWire::read(STDIN);
    if (($ready['command'] ?? null) !== 'go'
        || ($ready['phase'] ?? null) !== 'ready'
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
    $queries = PublicationDestinationConcurrencyCommand::queries();
    $frame = [
        'op' => $operation,
        'attempt' => $attempt,
        'phase' => 'result',
        'ok' => false,
        'error' => get_class($exception) . ': ' . $exception->getMessage(),
        'mysql_code' => $exception instanceof \yii\db\Exception
            && isset($exception->errorInfo[1]) ? (int)$exception->errorInfo[1] : null,
        'queries' => $queries,
    ];
    PublicationDestinationConcurrencyWire::write(STDOUT, $frame);
    exit(1);
}

function runConcurrencyOperation($operation, array $request, $db, &$attempt, array &$queries)
{
    if ($operation === 'preflight') {
        return ['round_trip' => true];
    }
    if ($operation === 'lock_probe') {
        return runLockProbe($request['row'], $db);
    }
    if ($operation === 'insert_competing_row') {
        return insertCompetingRow($request, $db);
    }

    assertFixtureManifest($request['manifest'] ?? [], $db);
    $probe = new PublicationDestinationConcurrencyProbe($operation, function ($value) use (&$attempt) {
        $attempt = (int)$value;
    });
    $registry = new PublicationDestinationRegistry($db, null, null, $probe);
    $item = $request['item'] ?? [];

    switch ($operation) {
        case 'register_owned':
            $result = $registry->registerOwned($item, $request['pointer']);
            break;
        case 'attach_by_id':
            $result = $registry->attach($item, (int)$request['destination_id']);
            break;
        case 'attach_by_pointer':
            $result = $registry->attach($item, $request['pointer']);
            break;
        case 'release':
            $result = $registry->release($item);
            break;
        case 'retire':
            $result = $registry->retire((int)$request['destination_id']);
            break;
        case 'detach':
            $result = $registry->detach($item);
            break;
        case 'follow':
            $result = $registry->follow((int)$request['destination_id'], $request['pointer']);
            break;
        default:
            throw new \RuntimeException('Unknown concurrency worker operation: ' . $operation);
    }

    return json_decode(json_encode($result, JSON_UNESCAPED_SLASHES), true);
}

function assertFixtureManifest(array $manifest, $db)
{
    foreach (($manifest['submissions'] ?? []) as $id) {
        assertVisible($db, 'SELECT COUNT(*) FROM faculty_submissions WHERE submission_id = :id', $id);
    }
    foreach (($manifest['items'] ?? []) as $item) {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        assertVisible($db, 'SELECT COUNT(*) FROM ' . $table . ' WHERE id = :id', $item['id']);
    }
    foreach (($manifest['destinations'] ?? []) as $id) {
        assertVisible($db, 'SELECT COUNT(*) FROM publication_destinations WHERE id = :id', $id);
    }
    foreach (($manifest['pointers'] ?? []) as $pointer) {
        $table = $pointer['kind'] === 'electronic' ? 'course_resources' : 'physical_resource_references';
        $column = $pointer['kind'] === 'electronic' ? 'course_resource_id' : 'reference_id';
        assertVisible($db, 'SELECT COUNT(*) FROM ' . $table . ' WHERE ' . $column . ' = :id', $pointer['id']);
    }
}

function assertVisible($db, $sql, $id)
{
    if ((int)$db->createCommand($sql, [':id' => $id])->queryScalar() !== 1) {
        throw new \RuntimeException('Worker could not see committed fixture row ' . $id . '.');
    }
}

function runLockProbe(array $row, $db)
{
    $queries = [
        'submission' => ['SELECT submission_id FROM faculty_submissions WHERE submission_id = :id FOR UPDATE', [':id' => $row['id']]],
        'new_item' => ['SELECT id FROM submission_new_resources WHERE id = :id FOR UPDATE', [':id' => $row['id']]],
        'reuse_item' => ['SELECT id FROM submission_reuse_resources WHERE id = :id FOR UPDATE', [':id' => $row['id']]],
        'state' => [
            'SELECT item_id FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id FOR UPDATE',
            [':kind' => $row['item_kind'], ':id' => $row['id']],
        ],
        'attachment' => ['SELECT id FROM publication_attachments WHERE id = :id FOR UPDATE', [':id' => $row['id']]],
        'destination' => ['SELECT id FROM publication_destinations WHERE id = :id FOR UPDATE', [':id' => $row['id']]],
        'offering' => ['SELECT offering_id FROM course_offerings WHERE offering_id = :id FOR UPDATE', [':id' => $row['id']]],
        'resource' => ['SELECT resource_id FROM resources WHERE resource_id = :id FOR UPDATE', [':id' => $row['id']]],
        'course_resource' => ['SELECT course_resource_id FROM course_resources WHERE course_resource_id = :id FOR UPDATE', [':id' => $row['id']]],
        'physical_reference' => ['SELECT reference_id FROM physical_resource_references WHERE reference_id = :id FOR UPDATE', [':id' => $row['id']]],
    ];
    if (!isset($queries[$row['kind']])) {
        throw new \RuntimeException('Unsupported lock probe row kind.');
    }

    $transaction = $db->beginTransaction();
    $db->createCommand('SET SESSION innodb_lock_wait_timeout = 1')->execute();
    try {
        $db->createCommand($queries[$row['kind']][0], $queries[$row['kind']][1])->queryScalar();
        return ['kind' => $row['kind'], 'outcome' => 'acquired'];
    } catch (\yii\db\Exception $exception) {
        $errorCode = isset($exception->errorInfo[1]) ? (int)$exception->errorInfo[1] : null;
        if ($errorCode !== 1205) {
            throw new \RuntimeException('Expected lock probe error 1205, got ' . (string)$errorCode, 0, $exception);
        }
        return ['kind' => $row['kind'], 'outcome' => 'contended', 'mysql_code' => 1205];
    } finally {
        if ($transaction->isActive) {
            $transaction->rollBack();
        }
        $db->createCommand('SET SESSION innodb_lock_wait_timeout = 10')->execute();
    }
}

function insertCompetingRow(array $request, $db)
{
    $table = $request['table'] ?? '';
    if (!in_array($table, ['publication_destinations', 'publication_attachments'], true)) {
        throw new \RuntimeException('Unsupported competing-row table.');
    }

    $db->createCommand('SET SESSION FOREIGN_KEY_CHECKS = 0')->execute();
    try {
        $db->createCommand()->insert($table, $request['values'])->execute();
        return ['id' => (int)$db->getLastInsertID()];
    } finally {
        $db->createCommand('SET SESSION FOREIGN_KEY_CHECKS = 1')->execute();
    }
}

try {
    $result = runConcurrencyOperation($operation, $request, $db, $attempt, $queries);
    $queries = PublicationDestinationConcurrencyCommand::queries();
    PublicationDestinationConcurrencyWire::write(STDOUT, [
        'op' => $operation,
        'attempt' => $attempt,
        'phase' => 'result',
        'ok' => true,
        'result' => $result,
        'queries' => $queries,
    ]);
    exit(0);
} catch (\Throwable $exception) {
    $queries = PublicationDestinationConcurrencyCommand::queries();
    $errorCode = $exception instanceof \yii\db\Exception && isset($exception->errorInfo[1])
        ? (int)$exception->errorInfo[1] : null;
    PublicationDestinationConcurrencyWire::write(STDOUT, [
        'op' => $operation,
        'attempt' => $attempt,
        'phase' => 'result',
        'ok' => false,
        'error' => get_class($exception) . ': ' . $exception->getMessage(),
        'mysql_code' => $errorCode,
        'queries' => $queries,
    ]);
    exit(1);
}

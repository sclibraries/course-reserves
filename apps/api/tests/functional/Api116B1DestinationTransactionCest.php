<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;
use app\services\PublicationDestinationContention;
use app\services\PublicationDestinationRestartRequired;
use app\services\PublicationDestinationTransaction;
use app\services\Transactional;

/**
 * API-116B1 deadlock handling of PublicationDestinationTransaction (design rule 4, plan-check answer #2).
 * MySQL failures are real-shaped: Yii's own conversion of a PDOException with the server's SQLSTATE, code and text.
 * A simulated deadlock first rolls the transaction back on the server, as MariaDB does before it reports 1213.
 */
class Api116B1DestinationTransactionCest extends BaseFunctionalCest
{
    private const FAILURES = [
        1213 => ['40001', 'Serialization failure', 'Deadlock found when trying to get lock; try restarting transaction'],
        1205 => ['HY000', 'General error', 'Lock wait timeout exceeded; try restarting transaction'],
        1062 => ['23000', 'Integrity constraint violation', "Duplicate entry '7' for key 'uq_pub_dest_course_resource'"],
    ];

    private $restore;
    private $prefix;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        // The probe implements an app\\services interface, so it loads once Yii's autoloader is up.
        require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencyRecordingProbe.php';
        $this->restore = Api116B1CommittedConnection::swap();
        $this->prefix = 'test-api116b1-tx-' . substr(md5(uniqid('', true)), 0, 8);
    }

    /** Cleans up on the committed connection, where deletes are real, and only then restores Codeception's. */
    public function _after(FunctionalTester $I)
    {
        try {
            \Yii::$app->db->createCommand('DELETE FROM courses WHERE course_number LIKE :p', [':p' => $this->prefix . '%'])->execute();
            Assert::assertSame(0, Api116B1CommittedConnection::level());
            Assert::assertSame([], $this->courseNames());
        } finally {
            call_user_func($this->restore);
        }
    }

    public function testOutermostDeadlockThreeTimesRaisesContentionAfterExactlyThreeAttempts(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $calls = 0;
        $this->expectContention(function () use (&$calls, $probe) {
            PublicationDestinationTransaction::run(function ($attempt) use (&$calls) {
                $calls++;
                $this->insertCourse('-attempt-' . $attempt);
                throw $this->deadlock();
            }, $probe);
        });
        Assert::assertSame(3, $calls);
        Assert::assertSame([
            'attempt_started:1', 'attempt_failed:1:1213', 'attempt_started:2', 'attempt_failed:2:1213',
            'attempt_started:3', 'attempt_failed:3:1213',
        ], $this->events($probe));
        $this->assertCleanAfterFailure();
    }

    public function testOutermostDeadlockOnceRetriesTheWholeCallbackOnAFreshTransaction(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = PublicationDestinationTransaction::run(function ($attempt) {
            $this->insertCourse('-attempt-' . $attempt);
            if ($attempt === 1) {
                throw $this->deadlock();
            }
            return 'committed on ' . $attempt;
        }, $probe);
        Assert::assertSame('committed on 2', $result);
        Assert::assertSame(
            ['attempt_started:1', 'attempt_failed:1:1213', 'attempt_started:2', 'before_commit:2', 'committed:2'],
            $this->events($probe)
        );
        Assert::assertSame([$this->prefix . '-attempt-2'], $this->courseNames());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function testOutermostLockWaitTimeoutIsNotRetriedAndRollsBackFully(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $calls = 0;
        $this->expectContention(function () use (&$calls, $probe) {
            PublicationDestinationTransaction::run(function () use (&$calls) {
                $calls++;
                $this->insertCourse('-written-before-timeout');
                throw $this->failure(1205);
            }, $probe);
        });
        Assert::assertSame(1, $calls);
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:1205'], $this->events($probe));
        $this->assertCleanAfterFailure();
    }

    public function testOutermostRegistryDuplicateKeyIsRetriedAfterAFullRollback(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = PublicationDestinationTransaction::run(function ($attempt) {
            $this->insertCourse('-attempt-' . $attempt);
            if ($attempt === 1) {
                throw $this->failure(1062);
            }
            return 'committed on ' . $attempt;
        }, $probe);
        Assert::assertSame('committed on 2', $result);
        Assert::assertSame(
            ['attempt_started:1', 'attempt_failed:1:1062', 'attempt_started:2', 'before_commit:2', 'committed:2'],
            $this->events($probe)
        );
        Assert::assertSame([$this->prefix . '-attempt-2'], $this->courseNames());
    }

    public function testOutermostDuplicateOnAnUnrelatedKeyPropagatesWithoutRetry(FunctionalTester $I)
    {
        $calls = 0;
        try {
            PublicationDestinationTransaction::run(function () use (&$calls) {
                $calls++;
                $this->insertCourse('-unrelated-duplicate');
                throw $this->failure(1062, "Duplicate entry 'x' for key 'uq_unrelated_key'");
            });
            Assert::fail('A duplicate on a non-registry key must propagate.');
        } catch (\yii\db\IntegrityException $exception) {
            Assert::assertSame(1062, (int)$exception->errorInfo[1]);
        }
        Assert::assertSame(1, $calls);
        $this->assertCleanAfterFailure();
    }

    public function testNestedDeadlockAtLevelOneRaisesRestartRequiredAndEndsTheCallersTransaction(FunctionalTester $I)
    {
        $this->assertNestedRestart(1, 1213);
    }

    public function testNestedDeadlockAtLevelTwoRaisesRestartRequiredAndEndsTheCallersTransaction(FunctionalTester $I)
    {
        $this->assertNestedRestart(2, 1213);
    }

    public function testNestedLockWaitTimeoutAtLevelOneRaisesRestartRequiredAfterAFullRollback(FunctionalTester $I)
    {
        $this->assertNestedRestart(1, 1205);
    }

    public function testNestedLockWaitTimeoutAtLevelTwoRaisesRestartRequiredAfterAFullRollback(FunctionalTester $I)
    {
        $this->assertNestedRestart(2, 1205);
    }

    /** #2: RestartRequired keeps the original code as its cause, so an outer caller never retries a nested 1205. */
    public function testOutermostDoesNotRetryANestedLockWaitTimeout(FunctionalTester $I)
    {
        $outer = new PublicationDestinationConcurrencyRecordingProbe();
        $inner = new PublicationDestinationConcurrencyRecordingProbe();
        $calls = 0;
        $this->expectContention(function () use (&$calls, $outer, $inner) {
            PublicationDestinationTransaction::run(function ($attempt) use (&$calls, $inner) {
                $calls++;
                $this->insertCourse('-outer-' . $attempt);
                return PublicationDestinationTransaction::run(function () {
                    $this->insertCourse('-inner');
                    throw $this->failure(1205);
                }, $inner);
            }, $outer);
        });
        Assert::assertSame(1, $calls);
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:1205'], $this->events($inner));
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:1205'], $this->events($outer));
        $this->assertCleanAfterFailure();
    }

    public function testOutermostRetriesANestedDeadlockRestartOnAFreshTransaction(FunctionalTester $I)
    {
        $outer = new PublicationDestinationConcurrencyRecordingProbe();
        $result = PublicationDestinationTransaction::run(function ($attempt) {
            $this->insertCourse('-outer-' . $attempt);
            return PublicationDestinationTransaction::run(function () use ($attempt) {
                $this->insertCourse('-inner-' . $attempt);
                if ($attempt === 1) {
                    throw $this->deadlock();
                }
                return 'inner done on ' . $attempt;
            });
        }, $outer);
        Assert::assertSame('inner done on 2', $result);
        Assert::assertSame(
            ['attempt_started:1', 'attempt_failed:1:1213', 'attempt_started:2', 'before_commit:2', 'committed:2'],
            $this->events($outer)
        );
        Assert::assertSame([$this->prefix . '-inner-2', $this->prefix . '-outer-2'], $this->courseNames());
    }

    /** Review #1: a deadlock inside a Transactional block in the registry callback is still classified and retried. */
    public function testOutermostRetriesADeadlockRaisedInsideATransactionalBlock(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = PublicationDestinationTransaction::run(function ($attempt) {
            $this->insertCourse('-outer-' . $attempt);
            return Transactional::run(function () use ($attempt) {
                $this->insertCourse('-inner-' . $attempt);
                if ($attempt === 1) {
                    throw $this->deadlock();
                }
                return 'inner block done on ' . $attempt;
            });
        }, $probe);
        Assert::assertSame('inner block done on 2', $result);
        Assert::assertSame(
            ['attempt_started:1', 'attempt_failed:1:1213', 'attempt_started:2', 'before_commit:2', 'committed:2'],
            $this->events($probe)
        );
        Assert::assertSame([$this->prefix . '-inner-2', $this->prefix . '-outer-2'], $this->courseNames());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    /** Review #1, nested: caller block -> registry -> Transactional block -> deadlock raises RestartRequired(1213). */
    public function testNestedDeadlockInsideATransactionalBlockRaisesRestartRequired(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $levelAtRestart = null;
        try {
            Transactional::run(function () use ($probe, &$levelAtRestart) {
                $this->insertCourse('-caller');
                try {
                    return PublicationDestinationTransaction::run(function () {
                        return Transactional::run(function () {
                            $this->insertCourse('-inner-block');
                            throw $this->deadlock();
                        });
                    }, $probe);
                } finally {
                    $levelAtRestart = Api116B1CommittedConnection::level();
                }
            });
            Assert::fail('A deadlock inside the nested registry call must raise RestartRequired.');
        } catch (\Throwable $exception) {
            Assert::assertInstanceOf(PublicationDestinationRestartRequired::class, $exception, $this->describe($exception));
            Assert::assertSame(1213, (int)$exception->getPrevious()->errorInfo[1]);
        }
        Assert::assertSame(0, $levelAtRestart);
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:1213'], $this->events($probe));
        $this->assertCleanAfterFailure();
    }

    /**
     * Review #2: when the real rollback after a 1205 fails (the server connection is gone), the original cause is
     * kept, the cleanup failure is recorded and the connection is closed instead of being reused.
     */
    public function testOutermostFailedRealRollbackClosesTheConnectionAndKeepsTheCause(FunctionalTester $I)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $closedAfterFailure = null;
        // The killed connection gets its own PDO, so Codeception never hands that dead PDO to later code.
        $committed = \Yii::$app->db;
        \Yii::$app->set('db', Api116B1CommittedConnection::open($committed, [\PDO::ATTR_CASE => \PDO::CASE_NATURAL, \PDO::ATTR_TIMEOUT => 7]));
        try {
            PublicationDestinationTransaction::run(function () {
                $this->insertCourse('-before-lost-connection');
                $this->killCurrentConnection();
                throw $this->failure(1205);
            }, $probe);
            Assert::fail('Expected destination_contention.');
        } catch (\Throwable $exception) {
            $closedAfterFailure = !\Yii::$app->db->getIsActive();
            Assert::assertInstanceOf(PublicationDestinationContention::class, $exception, $this->describe($exception));
            Assert::assertSame(1205, (int)$exception->getPrevious()->errorInfo[1], 'The original cause is kept.');
        } finally {
            \Yii::$app->set('db', $committed);
        }
        Assert::assertTrue($closedAfterFailure, 'A connection whose rollback failed is closed, not reused.');
        Assert::assertSame(['attempt_started:1', 'cleanup_failed:1', 'attempt_failed:1:1205'], $this->events($probe));
        $this->assertCleanAfterFailure();
    }

    /** Callers at level 1 or >= 2 (Transactional wrappers that wrote rows) see only the restart, never a second error. */
    private function assertNestedRestart($levels, $code)
    {
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $calls = 0;
        $levelAtRestart = null;
        $call = function () use (&$calls, &$levelAtRestart, $probe, $code) {
            try {
                return PublicationDestinationTransaction::run(function () use (&$calls, $code) {
                    $calls++;
                    $this->insertCourse('-nested');
                    throw $code === 1213 ? $this->deadlock() : $this->failure($code);
                }, $probe);
            } finally {
                $levelAtRestart = Api116B1CommittedConnection::level();
            }
        };
        for ($level = $levels; $level >= 1; $level--) {
            $call = function () use ($call, $level) {
                return Transactional::run(function () use ($call, $level) {
                    $this->insertCourse('-caller-L' . $level);
                    return call_user_func($call);
                });
            };
        }
        try {
            call_user_func($call);
            Assert::fail('A nested registry failure must raise RestartRequired.');
        } catch (\Throwable $exception) {
            Assert::assertInstanceOf(PublicationDestinationRestartRequired::class, $exception, $this->describe($exception));
            $cause = $exception->getPrevious();
            Assert::assertInstanceOf(\yii\db\Exception::class, $cause);
            Assert::assertSame($code, (int)$cause->errorInfo[1], 'RestartRequired keeps the original MySQL code.');
        }
        Assert::assertSame(1, $calls);
        Assert::assertSame(0, $levelAtRestart, 'The registry ends the Yii transaction before raising the restart.');
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:' . $code], $this->events($probe));
        $this->assertCleanAfterFailure();
    }

    private function assertCleanAfterFailure()
    {
        Assert::assertSame([], $this->courseNames(), 'No write of a failed attempt or its callers may persist.');
        Assert::assertSame(0, Api116B1CommittedConnection::level());
        $transaction = \Yii::$app->db->beginTransaction();
        Assert::assertSame(1, $transaction->level);
        $this->insertCourse('-new-transaction');
        $transaction->commit();
        Assert::assertSame([$this->prefix . '-new-transaction'], $this->courseNames());
    }

    private function expectContention(callable $callback)
    {
        try {
            call_user_func($callback);
            Assert::fail('Expected destination_contention.');
        } catch (\Throwable $exception) {
            Assert::assertInstanceOf(PublicationDestinationContention::class, $exception, $this->describe($exception));
            Assert::assertSame('destination_contention', $exception->errorCode);
        }
    }

    private function describe(\Throwable $exception)
    {
        return 'Got ' . get_class($exception) . ': ' . strtok($exception->getMessage(), "\n");
    }

    private function deadlock()
    {
        \Yii::$app->db->createCommand('ROLLBACK')->execute();
        return $this->failure(1213);
    }

    private function failure($code, $text = null)
    {
        list($state, $class, $default) = self::FAILURES[$code];
        $text = $text ?? $default;
        $pdo = new \PDOException('SQLSTATE[' . $state . ']: ' . $class . ': ' . $code . ' ' . $text);
        $pdo->errorInfo = [$state, $code, $text];
        return \Yii::$app->db->getSchema()->convertException($pdo, 'INSERT INTO publication_destinations (id) VALUES (7)');
    }

    /** Kills this connection from another one, so its next statement, the rollback, really fails. */
    private function killCurrentConnection()
    {
        $id = (int)\Yii::$app->db->createCommand('SELECT CONNECTION_ID()')->queryScalar();
        $original = \Yii::$app->db;
        $killer = new \yii\db\Connection(['dsn' => $original->dsn, 'username' => $original->username, 'password' => $original->password]);
        $killer->createCommand('KILL ' . $id)->execute();
        $killer->close();
    }

    private function insertCourse($suffix)
    {
        $name = $this->prefix . $suffix;
        \Yii::$app->db->createCommand()->insert('courses', ['course_name' => $name, 'course_number' => $name])->execute();
    }

    private function courseNames()
    {
        return \Yii::$app->db->createCommand(
            'SELECT course_number FROM courses WHERE course_number LIKE :p ORDER BY course_number', [':p' => $this->prefix . '%']
        )->queryColumn();
    }

    private function events(PublicationDestinationConcurrencyRecordingProbe $probe)
    {
        return array_map(function ($event) {
            $code = $event['phase'] === 'attempt_failed' ? ':' . ($event['context']['mysql_code'] ?? '?') : '';
            return $event['phase'] . ':' . $event['attempt'] . $code;
        }, $probe->events);
    }
}

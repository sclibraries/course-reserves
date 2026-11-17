<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;
use app\services\ItemAssociationChanged;
use app\services\ItemContention;
use app\services\Transactional;

class Api119A1RetryingCest extends BaseFunctionalCest
{
    private const FAILURES = [
        1213 => ['40001', 'Serialization failure', 'Deadlock found when trying to get lock; try restarting transaction'],
        1205 => ['HY000', 'General error', 'Lock wait timeout exceeded; try restarting transaction'],
    ];

    private $restore;
    private $prefix;
    private $originalLogger;
    private $logger;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restore = Api116B1CommittedConnection::swap();
        $this->prefix = 'test-api119a1-' . substr(md5(uniqid('', true)), 0, 8);
        $this->originalLogger = \Yii::getLogger();
        $this->logger = new \yii\log\Logger();
        $this->logger->flushInterval = 0;
        \Yii::setLogger($this->logger);
    }

    public function _after(FunctionalTester $I)
    {
        try {
            \Yii::setLogger($this->originalLogger);
            if (\Yii::$app->has('workflowNotificationQueue')) {
                \Yii::$app->get('workflowNotificationQueue')->discard();
            }
            \Yii::$app->db->createCommand('DELETE FROM courses WHERE course_number LIKE :prefix', [
                ':prefix' => $this->prefix . '%',
            ])->execute();
            unset(\Yii::$app->controllerMap['api119a1-plain'], \Yii::$app->controllerMap['api119a1-rest']);
        } finally {
            call_user_func($this->restore);
        }
    }

    public function testRetriesTwoDeadlocksAndFlushesOnlyTheCommittedAttempt(FunctionalTester $I)
    {
        $queue = \Yii::$app->get('workflowNotificationQueue');
        $observer = Api116B1CommittedConnection::open(\Yii::$app->db, [\PDO::ATTR_CASE => \PDO::CASE_NATURAL]);
        $attempts = 0;
        $notifications = [];

        try {
            $result = Transactional::retrying(function () use (&$attempts, $queue, $observer, &$notifications) {
                $attempt = ++$attempts;
                $this->insertCourse('-attempt-' . $attempt);
                $queue->enqueue(function () use ($attempt, $observer, &$notifications) {
                    $notifications[] = [
                        'attempt' => $attempt,
                        'rows' => $observer->createCommand(
                            'SELECT course_name FROM courses WHERE course_number LIKE :prefix ORDER BY course_name',
                            [':prefix' => $this->prefix . '%']
                        )->queryColumn(),
                    ];
                });
                if ($attempt < 3) {
                    throw $this->deadlock();
                }
                return 'committed';
            });
        } finally {
            $observer->close();
        }

        Assert::assertSame('committed', $result);
        Assert::assertSame(3, $attempts);
        Assert::assertSame([['attempt' => 3, 'rows' => [$this->prefix . '-attempt-3']]], $notifications);
        Assert::assertSame([$this->prefix . '-attempt-3'], $this->courseNames());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function testThreeDeadlocksGiveContentionAndMixedRetryCausesShareBudget(FunctionalTester $I)
    {
        $queue = \Yii::$app->get('workflowNotificationQueue');
        $attempts = 0;
        $sent = 0;
        $logStart = count($this->logger->messages);

        try {
            Transactional::retrying(function () use (&$attempts, $queue, &$sent) {
                $attempt = ++$attempts;
                $this->insertCourse('-attempt-' . $attempt);
                $queue->enqueue(function () use (&$sent) {
                    $sent++;
                });
                throw $this->deadlock();
            });
            Assert::fail('Expected item contention after three retryable failures.');
        } catch (ItemContention $exception) {
            Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $exception->reference);
            $logs = array_slice($this->logger->messages, $logStart);
            Assert::assertTrue(
                (bool)array_filter($logs, function ($entry) use ($exception) {
                    return strpos($entry[0], $exception->reference) !== false;
                }),
                'The generated contention reference is logged.'
            );
        }

        Assert::assertSame(3, $attempts);
        Assert::assertSame(0, $sent);
        Assert::assertSame([], $this->courseNames());
        Assert::assertSame(0, Api116B1CommittedConnection::level());

        $attempts = 0;
        $result = Transactional::retrying(function () use (&$attempts) {
            $attempt = ++$attempts;
            $this->insertCourse('-mixed-' . $attempt);
            if ($attempt === 1) {
                throw $this->deadlock();
            }
            if ($attempt === 2) {
                throw new ItemAssociationChanged('The item moved during processing.');
            }
            return 'committed';
        });
        Assert::assertSame('committed', $result);
        Assert::assertSame(3, $attempts);
        Assert::assertSame([$this->prefix . '-mixed-3'], $this->courseNames());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function testTimeoutIsNotRetriedAndNestedRetryingRethrows(FunctionalTester $I)
    {
        $attempts = 0;
        try {
            Transactional::retrying(function () use (&$attempts) {
                $attempts++;
                $this->insertCourse('-timeout');
                throw $this->failure(1205);
            });
            Assert::fail('Expected the lock wait timeout to propagate.');
        } catch (\yii\db\Exception $exception) {
            Assert::assertSame(1205, (int)$exception->errorInfo[1]);
        }
        Assert::assertSame(1, $attempts);
        Assert::assertSame([], $this->courseNames());
        Assert::assertSame(0, Api116B1CommittedConnection::level());

        $nested = new ItemAssociationChanged('A nested retry owner must rethrow.');
        $attempts = 0;
        try {
            Transactional::run(function () use ($nested, &$attempts) {
                return Transactional::retrying(function () use ($nested, &$attempts) {
                    $attempts++;
                    throw $nested;
                });
            });
            Assert::fail('Expected the nested retry owner to rethrow.');
        } catch (ItemAssociationChanged $exception) {
            Assert::assertSame($nested, $exception);
        }
        Assert::assertSame(1, $attempts);
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function testNotifierFailureIsLoggedAfterCommitWithoutRetryAndQueueSupportsManualUse(FunctionalTester $I)
    {
        $queue = \Yii::$app->get('workflowNotificationQueue');
        $attempts = 0;
        $logStart = count($this->logger->messages);
        $result = Transactional::retrying(function () use (&$attempts, $queue) {
            $attempts++;
            $this->insertCourse('-notifier-failure');
            $queue->enqueue(function () {
                throw new \RuntimeException('Synthetic notifier failure.');
            });
            return 'committed';
        });

        Assert::assertSame('committed', $result);
        Assert::assertSame(1, $attempts);
        Assert::assertSame([$this->prefix . '-notifier-failure'], $this->courseNames());
        $logs = array_slice($this->logger->messages, $logStart);
        Assert::assertTrue((bool)array_filter($logs, function ($entry) {
            return strpos($entry[0], 'Workflow notification failed') !== false
                && preg_match('/reference=[A-HJ-NP-Z2-9]{6}/', $entry[0]);
        }), 'A failed notification is logged with a generated reference: ' . var_export($logs, true));

        $sent = [];
        $queue->enqueue(function () use (&$sent) {
            $sent[] = 'first';
        });
        $queue->enqueue(function () use (&$sent) {
            $sent[] = 'second';
        });
        $queue->flushAfterCommit();
        $queue->enqueue(function () use (&$sent) {
            $sent[] = 'discarded';
        });
        $queue->discard();
        $queue->flushAfterCommit();
        Assert::assertSame(['first', 'second'], $sent);
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function testContentionIsMappedForPlainAndBaseRestControllers(FunctionalTester $I)
    {
        \Yii::$app->controllerMap['api119a1-plain'] = get_class(new class ('api119a1-plain', \Yii::$app) extends \yii\web\Controller {
            public function actionContention()
            {
                throw new \app\services\ItemContention('TEST19A1');
            }
        });
        \Yii::$app->controllerMap['api119a1-rest'] = get_class(new class ('api119a1-rest', \Yii::$app) extends \app\controllers\BaseRestController {
            public function behaviors()
            {
                $behaviors = parent::behaviors();
                unset($behaviors['authenticator']);
                return $behaviors;
            }

            public function actionContention()
            {
                throw new \app\services\ItemContention('TEST19A1');
            }
        });

        foreach (['api119a1-plain/contention', 'api119a1-rest/contention'] as $route) {
            $I->sendJsonRequest('GET', $route);
            $I->seeResponseCodeIs(409);
            Assert::assertSame(
                ['error_code' => 'item_contention', 'reference' => 'TEST19A1'],
                json_decode($I->grabPageSource(), true)
            );
        }
    }

    private function deadlock()
    {
        \Yii::$app->db->createCommand('ROLLBACK')->execute();
        return $this->failure(1213);
    }

    private function failure($code)
    {
        list($state, $class, $text) = self::FAILURES[$code];
        $pdo = new \PDOException('SQLSTATE[' . $state . ']: ' . $class . ': ' . $code . ' ' . $text);
        $pdo->errorInfo = [$state, $code, $text];
        return \Yii::$app->db->getSchema()->convertException($pdo, 'UPDATE courses SET course_name = course_name');
    }

    private function insertCourse($suffix)
    {
        $name = $this->prefix . $suffix;
        \Yii::$app->db->createCommand()->insert('courses', [
            'course_name' => $name,
            'course_number' => $name,
        ])->execute();
    }

    private function courseNames()
    {
        return \Yii::$app->db->createCommand(
            'SELECT course_name FROM courses WHERE course_number LIKE :prefix ORDER BY course_name',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
    }
}

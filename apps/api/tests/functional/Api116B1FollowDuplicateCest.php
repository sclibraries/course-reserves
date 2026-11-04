<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;
use app\services\PublicationDestinationRegistry;
use app\services\PublicationDestinationRestartRequired;
use app\services\Transactional;

/**
 * API-116B1 review #3: a duplicate key raised by follow()'s pointer update restarts cleanly (a 1062 on a registry
 * key is handled like a deadlock) instead of a PHP Error from an inaccessible restart method. The replacement's
 * registry row is hidden from the destinationForPointer() seam during attempt 1 only, so the UPDATE meets the key.
 * Fixtures are committed on a connection outside Codeception's transaction, so the registry call is outermost.
 */
class Api116B1FollowDuplicateCest extends BaseFunctionalCest
{
    private $restore;
    private $fixtures;
    private $sourceId;
    private $occupiedId;
    private $replacement;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        // The probe implements an app\\services interface, so it loads once Yii's autoloader is up.
        require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencyRecordingProbe.php';
        $this->restore = Api116B1CommittedConnection::swap();
        $this->fixtures = new Api116AFixture('test-api116b1-follow-dup-');
        $offering = $this->fixtures->createOffering('follow-duplicate');
        $this->sourceId = $this->insertDestination($this->fixtures->createElectronicDestination($offering, 'source'));
        $this->replacement = $this->fixtures->createElectronicDestination($offering, 'replacement');
        $this->occupiedId = $this->insertDestination($this->replacement);
    }

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('publication_destinations', ['id' => [$this->sourceId, $this->occupiedId]])->execute();
        $this->fixtures->cleanup();
        call_user_func($this->restore);
    }

    public function testOutermostFollowDuplicateRestartsAndReturnsTheCurrentConflict(FunctionalTester $I)
    {
        $before = $this->rows();
        $probe = $this->attemptProbe();
        $result = $this->hidingRegistry($probe)->follow($this->sourceId, $this->replacement);
        Assert::assertSame(['status' => 409, 'body' => ['error_code' => 'destination_occupied']], $result);
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:1062', 'attempt_started:2', 'committed:2'], $this->events($probe));
        Assert::assertSame($before, $this->rows());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function testNestedFollowDuplicateRaisesRestartRequiredWithTheDuplicateAsCause(FunctionalTester $I)
    {
        $before = $this->rows();
        $probe = $this->attemptProbe();
        try {
            Transactional::run(function () use ($probe) {
                return $this->hidingRegistry($probe)->follow($this->sourceId, $this->replacement);
            });
            Assert::fail('A nested follow() duplicate must raise RestartRequired.');
        } catch (\Throwable $exception) {
            Assert::assertInstanceOf(PublicationDestinationRestartRequired::class, $exception, get_class($exception)
                . ': ' . strtok($exception->getMessage(), "\n"));
            Assert::assertSame(1062, (int)$exception->getPrevious()->errorInfo[1]);
        }
        Assert::assertSame(['attempt_started:1', 'attempt_failed:1:1062'], $this->events($probe));
        Assert::assertSame($before, $this->rows());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    /** Records the current attempt for the hiding seam; events keep only the attempt boundaries. */
    private function attemptProbe()
    {
        return new class() extends PublicationDestinationConcurrencyRecordingProbe {
            public $attempt = 1;

            public function checkpoint($phase, $attempt, array $context = [])
            {
                parent::checkpoint($phase, $attempt, $context);
                if ($phase === 'attempt_started') {
                    $this->attempt = (int)$attempt;
                }
            }
        };
    }

    private function hidingRegistry($probe)
    {
        $registry = new class(\Yii::$app->db, null, null, $probe) extends PublicationDestinationRegistry {
            public $hiddenId;
            public $attemptProbe;

            protected function destinationForPointer(array $pointer, $forUpdate = false)
            {
                if ($this->attemptProbe->attempt === 1 && (int)$pointer['id'] === $this->hiddenId) {
                    return null;
                }
                return parent::destinationForPointer($pointer, $forUpdate);
            }
        };
        $registry->hiddenId = (int)$this->replacement['course_resource_id'];
        $registry->attemptProbe = $probe;
        return $registry;
    }

    private function insertDestination(array $pointer)
    {
        \Yii::$app->db->createCommand()->insert('publication_destinations', [
            'destination_kind' => 'electronic',
            'course_resource_id' => $pointer['course_resource_id'],
            'offering_id' => $pointer['offering_id'],
            'origin_offering_id' => $pointer['offering_id'],
            'ownership_source' => 'none',
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function rows()
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_destinations WHERE id IN (:a, :b) ORDER BY id',
            [':a' => $this->sourceId, ':b' => $this->occupiedId]
        )->queryAll();
    }

    private function events($probe)
    {
        $events = [];
        foreach ($probe->events as $event) {
            if (in_array($event['phase'], ['attempt_started', 'attempt_failed', 'committed'], true)) {
                $code = $event['phase'] === 'attempt_failed' ? ':' . ($event['context']['mysql_code'] ?? '?') : '';
                $events[] = $event['phase'] . ':' . $event['attempt'] . $code;
            }
        }
        return $events;
    }
}

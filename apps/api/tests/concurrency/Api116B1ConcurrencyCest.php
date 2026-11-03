<?php

require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencySupervisor.php';
require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencyFixtureTracker.php';
require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencyRecordingProbe.php';
require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencySqlObserver.php';

use app\services\PublicationDestinationContention;
use app\services\PublicationDestinationProbe;
use app\services\PublicationDestinationRegistry;
use app\services\PublicationDestinationRestartRequired;
use app\services\PublicationDestinationTransaction;
use PHPUnit\Framework\Assert;

/** Real-connection acceptance coverage for API-116B1's registry concurrency contract. */
class Api116B1ConcurrencyCest
{
    private $tracker;
    private $supervisor;
    private $offering;
    private $otherOffering;
    private $parentConnectionId;

    public function _before(ConcurrencyTester $I)
    {
        $prefix = 'test-api116b1-' . substr(md5(uniqid('', true)), 0, 10) . '-';
        $this->supervisor = new PublicationDestinationConcurrencySupervisor();
        $this->tracker = new PublicationDestinationConcurrencyFixtureTracker($prefix);
        $this->offering = $this->tracker->fixture()->createOffering('main');
        $this->otherOffering = $this->tracker->fixture()->createOffering('other');
        $this->parentConnectionId = (int)\Yii::$app->db->createCommand(
            'SELECT CONNECTION_ID()'
        )->queryScalar();
    }

    public function _after(ConcurrencyTester $I)
    {
        if ($this->tracker !== null) {
            $this->tracker->cleanup($this->supervisor);
        }
    }

    /** The first suite test fails closed when proc_open or framed pipes are unavailable. */
    public function test00PreflightRequiresProcOpenAndARealPipeRoundTrip(ConcurrencyTester $I)
    {
        Assert::assertTrue(function_exists('proc_open'), 'The test image must provide proc_open.');
        $this->supervisor->start('preflight', ['op' => 'preflight']);
        $ready = $this->supervisor->awaitPhase('preflight', 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, $ready['connection_id']);
        $this->supervisor->release('preflight', 'ready', 0);
        $result = $this->supervisor->complete('preflight');
        Assert::assertSame(['round_trip' => true], $result['result']);
        Assert::assertSame(
            ['ready', 'result'],
            $this->phases('preflight')
        );
    }

    public function testHarnessRejectsMalformedFramesMissingResultsAndDeadlines(ConcurrencyTester $I)
    {
        $this->supervisor->start('malformed', ['op' => 'harness_malformed']);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('malformed');
        }, 'Malformed concurrency frame');

        $this->supervisor->start('eof', ['op' => 'harness_eof']);
        $this->supervisor->awaitPhase('eof', 'ready', 0);
        $this->supervisor->release('eof', 'ready', 0);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('eof');
        }, 'EOF before the expected phase');

        $this->supervisor = new PublicationDestinationConcurrencySupervisor(1);
        $this->supervisor->start('deadline', ['op' => 'harness_stall']);
        $this->supervisor->awaitPhase('deadline', 'ready', 0);
        $this->supervisor->release('deadline', 'ready', 0);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('deadline');
        }, 'deadline exceeded');
        Assert::assertTrue($this->supervisor->allReaped());
    }

    /** @group protection */
    public function testTransactionRetriesTheWholeCallbackAndRollsBackTheFirstAttempt(ConcurrencyTester $I)
    {
        $db = \Yii::$app->db;
        $prefix = 'test-api116b1-retry-' . substr(md5(uniqid('', true)), 0, 8);
        $calls = 0;
        $probe = $this->recordingProbe();
        try {
            $value = PublicationDestinationTransaction::run(function () use ($db, $prefix, &$calls) {
                $calls++;
                $attempt = $calls;
                $name = $prefix . '-' . $attempt;
                $db->createCommand()->insert('courses', [
                    'course_name' => $name,
                    'course_number' => $name,
                ])->execute();
                if ($attempt === 1) {
                    throw new PublicationDestinationRestartRequired('new attachment discovered');
                }
                return 'completed';
            }, $probe);

            Assert::assertSame('completed', $value);
            Assert::assertSame(2, $calls);
            Assert::assertSame(0, $this->courseCount($prefix . '-1'));
            Assert::assertSame(1, $this->courseCount($prefix . '-2'));
            Assert::assertSame(['before_commit', 'committed'], $this->probePhases($probe));
        } finally {
            $db->createCommand()->delete('courses', ['course_number' => [$prefix . '-1', $prefix . '-2']])->execute();
        }
    }

    /** @group protection */
    public function testTransactionExhaustsExactlyThreeAttemptsWithContentionCode(ConcurrencyTester $I)
    {
        $db = \Yii::$app->db;
        $prefix = 'test-api116b1-exhaust-' . substr(md5(uniqid('', true)), 0, 8);
        $calls = 0;
        try {
            PublicationDestinationTransaction::run(function () use ($db, $prefix, &$calls) {
                $calls++;
                $attempt = $calls;
                $name = $prefix . '-' . $attempt;
                $db->createCommand()->insert('courses', [
                    'course_name' => $name,
                    'course_number' => $name,
                ])->execute();
                throw new PublicationDestinationRestartRequired('closure grew again');
            });
            Assert::fail('Three closure restarts must raise destination contention.');
        } catch (PublicationDestinationContention $exception) {
            Assert::assertSame('destination_contention', $exception->errorCode);
        } finally {
            $db->createCommand()->delete('courses', ['course_number' => [
                $prefix . '-1', $prefix . '-2', $prefix . '-3',
            ]])->execute();
        }
        Assert::assertSame(3, $calls);
        Assert::assertSame(0, $this->courseCountLike($prefix . '-%'));
    }

    /** @group protection */
    public function testNestedRestartEscapesAndCallerRollsBackEarlierAndRegistryWrites(ConcurrencyTester $I)
    {
        $item = $this->item('nested-restart-owner');
        $pointer = $this->electronic('nested-restart-entry');
        $prefix = 'test-api116b1-nested-' . substr(md5(uniqid('', true)), 0, 8);
        $calls = 0;
        $transaction = \Yii::$app->db->beginTransaction();
        try {
            \Yii::$app->db->createCommand()->insert('courses', [
                'course_name' => $prefix,
                'course_number' => $prefix,
            ])->execute();
            try {
                PublicationDestinationTransaction::run(function () use ($item, $pointer, &$calls) {
                    $calls++;
                    \Yii::$app->db->createCommand()->insert('publication_destinations', [
                        'destination_kind' => 'electronic',
                        'course_resource_id' => $pointer['course_resource_id'],
                        'offering_id' => $pointer['offering_id'],
                        'origin_offering_id' => $pointer['offering_id'],
                        'owner_item_kind' => $item['kind'],
                        'owner_item_id' => $item['id'],
                        'owner_live' => 1,
                        'ownership_source' => 'published',
                    ])->execute();
                    throw new PublicationDestinationRestartRequired('caller must restart');
                });
                Assert::fail('A nested registry call must not retry or return a normal result.');
            } catch (PublicationDestinationRestartRequired $exception) {
                $transaction->rollBack();
            }
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
        }
        Assert::assertSame(1, $calls);
        Assert::assertSame(0, $this->courseCount($prefix));
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM publication_destinations WHERE course_resource_id = :id',
            [':id' => $pointer['course_resource_id']]
        )->queryScalar());
    }

    /** @group protection */
    public function testFollowLocksOneCompleteMixedKindClosureInContractOrderAndPreservesInputs(ConcurrencyTester $I)
    {
        $fixture = $this->tracker->fixture();
        $instance = $this->instanceId();
        $physical = $this->physical('stage-new-physical', $instance);
        $electronic = $this->electronic('stage-old-electronic');
        $folderName = 'Synthetic folder before follow';
        \Yii::$app->db->createCommand()->insert('folders', ['name' => $folderName])->execute();
        $folderId = (int)\Yii::$app->db->getLastInsertID();
        $this->tracker->trackFolder($folderId);
        \Yii::$app->db->createCommand()->update('resources', [
            'folder_id' => $folderId,
        ], ['resource_id' => $electronic['resource_id']])->execute();

        $owner = $this->item('stage-owner', $this->offering);
        $attachedNew = $this->item('stage-attached-new', $this->offering);
        $attachedReuse = $this->item('stage-attached-reuse', $this->offering, 'legacy_reuse');
        foreach ([$owner, $attachedNew, $attachedReuse] as $item) {
            $this->setIdentity($item, $instance);
            $this->tracker->insertPublicationState($item);
        }

        $setupRegistry = new PublicationDestinationRegistry();
        $owned = $setupRegistry->registerOwned($owner, $electronic);
        Assert::assertSame(200, $owned['status']);
        $destinationId = (int)$owned['body']['destination']['id'];
        $this->tracker->trackDestination($destinationId);
        Assert::assertSame(200, $setupRegistry->attach($attachedNew, $destinationId)['status']);
        Assert::assertSame(200, $setupRegistry->attach($attachedReuse, $destinationId)['status']);

        $stateBefore = [
            $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
                ':kind' => $owner['kind'], ':id' => $owner['id'],
            ]),
            $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
                ':kind' => $attachedNew['kind'], ':id' => $attachedNew['id'],
            ]),
            $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
                ':kind' => $attachedReuse['kind'], ':id' => $attachedReuse['id'],
            ]),
        ];
        $inputBefore = [
            $fixture->itemRow($owner), $fixture->itemRow($attachedNew), $fixture->itemRow($attachedReuse),
        ];
        $eventsBefore = $this->workflowEventCount([$owner, $attachedNew, $attachedReuse]);
        $electronicBefore = $this->row(
            'resources', 'resource_id = :id', [':id' => $electronic['resource_id']]
        );
        $courseResourceBefore = $this->row(
            'course_resources', 'course_resource_id = :id', [':id' => $electronic['course_resource_id']]
        );
        $physicalBefore = $this->row(
            'physical_resource_references', 'reference_id = :id', [':id' => $physical['physical_reference_id']]
        );

        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $observer = new PublicationDestinationConcurrencySqlObserver();
        $observer->attach(\Yii::$app->db);
        $observer->reset();
        try {
            $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
                ->follow($destinationId, $physical);
        } finally {
            $observer->detach(\Yii::$app->db);
        }

        Assert::assertSame(200, $result['status']);
        $this->assertProbeAttempt($probe, 1);
        $events = $this->probeEventsForAttempt($probe, 1);
        $required = $events[0]['context']['required'];
        $acquired = $events[1]['context']['acquired'];
        Assert::assertSame($this->normalizeCoverage($required), $this->normalizeCoverage($acquired));
        Assert::assertContains($this->offering, $required['offering_ids']);
        Assert::assertContains($electronic['course_resource_id'], $required['course_resource_ids']);
        Assert::assertContains($physical['physical_reference_id'], $required['physical_reference_ids']);
        Assert::assertContains($destinationId, $required['destination_ids']);
        Assert::assertContains($owner['id'], $required['new_item_ids']);
        Assert::assertContains($attachedNew['id'], $required['new_item_ids']);
        Assert::assertContains($attachedReuse['id'], $required['reuse_item_ids']);
        Assert::assertContains($owner['submission_id'], $required['submission_ids']);
        Assert::assertContains($attachedNew['submission_id'], $required['submission_ids']);
        Assert::assertContains($attachedReuse['submission_id'], $required['submission_ids']);
        $stateKeys = $this->stateCoverageKeys($required['publication_state_items']);
        Assert::assertContains('new:' . $owner['id'], $stateKeys);
        Assert::assertContains('new:' . $attachedNew['id'], $stateKeys);
        Assert::assertContains('reuse:' . $attachedReuse['id'], $stateKeys);
        $attachmentIds = array_map('intval', $required['attachment_ids']);
        sort($attachmentIds, SORT_NUMERIC);
        $expectedAttachmentIds = [
            (int)$this->attachmentRows($attachedNew)[0]['id'],
            (int)$this->attachmentRows($attachedReuse)[0]['id'],
        ];
        sort($expectedAttachmentIds, SORT_NUMERIC);
        Assert::assertSame($expectedAttachmentIds, $attachmentIds);

        $this->assertSqlLockOrder($observer->queries(), [
            'course_offerings', 'resources', 'resource_metadata', 'resource_links', 'folders',
            'course_resources', 'physical_resource_references', 'publication_destinations',
            'faculty_submissions', 'submission_new_resources', 'submission_reuse_resources',
            'submission_publication_state', 'publication_attachments',
        ]);
        Assert::assertSame($stateBefore, [
            $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
                ':kind' => $owner['kind'], ':id' => $owner['id'],
            ]),
            $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
                ':kind' => $attachedNew['kind'], ':id' => $attachedNew['id'],
            ]),
            $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
                ':kind' => $attachedReuse['kind'], ':id' => $attachedReuse['id'],
            ]),
        ]);
        Assert::assertSame($inputBefore, [
            $fixture->itemRow($owner), $fixture->itemRow($attachedNew), $fixture->itemRow($attachedReuse),
        ]);
        Assert::assertSame($eventsBefore, $this->workflowEventCount([$owner, $attachedNew, $attachedReuse]));
        Assert::assertSame($electronicBefore, $this->row(
            'resources', 'resource_id = :id', [':id' => $electronic['resource_id']]
        ));
        Assert::assertSame($courseResourceBefore, $this->row(
            'course_resources', 'course_resource_id = :id', [':id' => $electronic['course_resource_id']]
        ));
        Assert::assertSame($physicalBefore, $this->row(
            'physical_resource_references', 'reference_id = :id', [':id' => $physical['physical_reference_id']]
        ));

        $destinationAfter = $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]);
        Assert::assertSame((string)$physical['physical_reference_id'], $destinationAfter['physical_reference_id']);
        Assert::assertSame(null, $destinationAfter['course_resource_id']);
        foreach ([$attachedNew, $attachedReuse] as $item) {
            $attachment = $this->attachmentRows($item)[0];
            Assert::assertSame('1', (string)$attachment['live']);
            $snapshot = json_decode($attachment['attached_snapshot_json'], true);
            Assert::assertSame('physical', $snapshot['destination_kind']);
            Assert::assertSame($physical['physical_reference_id'], (int)$snapshot['physical_reference_id']);
            Assert::assertSame($physicalBefore['external_resource_id'], $snapshot['external_id']);
        }
    }

    public function testEveryRegistryOperationUsesDiscoveryThenOneCompleteLockCall(ConcurrencyTester $I)
    {
        $setup = new PublicationDestinationRegistry();
        $measured = [];

        $registerItem = $this->item('stage-register-item');
        $registerPointer = $this->electronic('stage-register-pointer');
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->registerOwned($registerItem, $registerPointer);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        $attachOwner = $this->item('stage-attach-id-owner');
        $attachItem = $this->item('stage-attach-id-item');
        $attachPointer = $this->electronic('stage-attach-id-pointer');
        $attachDestination = $setup->registerOwned($attachOwner, $attachPointer);
        $attachDestinationId = (int)$attachDestination['body']['destination']['id'];
        $this->tracker->trackDestination($attachDestinationId);
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->attach($attachItem, $attachDestinationId);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        $pointerItem = $this->item('stage-attach-pointer-item');
        $lazyPointer = $this->electronic('stage-attach-pointer-entry');
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->attach($pointerItem, $lazyPointer);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        $releaseItem = $this->item('stage-release-item');
        $releasePointer = $this->electronic('stage-release-pointer');
        $releaseDestination = $setup->registerOwned($releaseItem, $releasePointer);
        $this->tracker->trackDestination((int)$releaseDestination['body']['destination']['id']);
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->release($releaseItem);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        $retireItem = $this->item('stage-retire-item');
        $retirePointer = $this->electronic('stage-retire-pointer');
        $retireDestinationId = $this->tracker->insertDestination($retirePointer);
        Assert::assertSame(200, $setup->attach($retireItem, $retireDestinationId)['status']);
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->retire($retireDestinationId);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        $detachItem = $this->item('stage-detach-item');
        $detachPointer = $this->electronic('stage-detach-pointer');
        Assert::assertSame(200, $setup->attach($detachItem, $detachPointer)['status']);
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->detach($detachItem);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        $followOwner = $this->item('stage-follow-owner');
        $followAttachment = $this->item('stage-follow-attachment');
        $followOldPointer = $this->electronic('stage-follow-old');
        $followNewPointer = $this->electronic('stage-follow-new');
        $followDestination = $setup->registerOwned($followOwner, $followOldPointer);
        $followDestinationId = (int)$followDestination['body']['destination']['id'];
        $this->tracker->trackDestination($followDestinationId);
        Assert::assertSame(200, $setup->attach($followAttachment, $followDestinationId)['status']);
        $probe = new PublicationDestinationConcurrencyRecordingProbe();
        $result = (new PublicationDestinationRegistry(\Yii::$app->db, null, null, $probe))
            ->follow($followDestinationId, $followNewPointer);
        Assert::assertSame(200, $result['status']);
        $measured[] = $probe;

        foreach ($measured as $operationProbe) {
            $this->assertProbeAttempt($operationProbe, 1);
            $events = $this->probeEventsForAttempt($operationProbe, 1);
            Assert::assertSame(
                $this->normalizeCoverage($events[0]['context']['required']),
                $this->normalizeCoverage($events[1]['context']['acquired'])
            );
        }
    }

    /** @group protection */
    public function test19NumericIdAttachUsesCurrentRetiredStateAfterRetireCommits(ConcurrencyTester $I)
    {
        $item = $this->item('numeric-retire-attach');
        $pointer = $this->electronic('numeric-retire-entry');
        $destinationId = $this->tracker->insertDestination($pointer);
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $destinationBefore = $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]);
        $attachReady = $this->startOperation('numeric-attach', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationId,
        ]);
        $this->assertWorkerReadyForDatabase($attachReady);
        $this->supervisor->awaitPhase('numeric-attach', 'discovered', 1);

        $retire = $this->runOperation('numeric-retire', 'retire', ['destination_id' => $destinationId]);
        $this->assertStatus($retire, 200);
        $retiredBeforeAttach = $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]);
        Assert::assertNull($retiredBeforeAttach['course_resource_id']);
        Assert::assertNotNull($retiredBeforeAttach['retired_at']);

        $this->supervisor->release('numeric-attach', 'discovered', 1);
        $attach = $this->supervisor->complete('numeric-attach');
        $this->assertStatus($attach, 409, 'destination_retired');
        $this->assertAttemptStages('numeric-attach', 1);
        Assert::assertSame(
            $retiredBeforeAttach,
            $this->row('publication_destinations', 'id = :id', [':id' => $destinationId])
        );
        Assert::assertSame([], $this->attachmentRows($item));
        Assert::assertSame($stateBefore, $this->stateRow($item));
    }

    public function test19PointerAttachAfterRetireStillLazilyCreatesANewRegistryRow(ConcurrencyTester $I)
    {
        $firstItem = $this->item('pointer-retire-first-item');
        $secondItem = $this->item('pointer-retire-pointer-item');
        $pointer = $this->electronic('pointer-retire-entry');
        $retiredId = $this->tracker->insertDestination($pointer);
        $retire = $this->runOperation('pointer-retire', 'retire', ['destination_id' => $retiredId]);
        $this->assertStatus($retire, 200);

        $attach = $this->runOperation('pointer-attach', 'attach_by_pointer', [
            'item' => $secondItem,
            'pointer' => $pointer,
        ]);
        $this->assertStatus($attach, 200);
        $this->assertAttemptStages('pointer-attach', 1);
        $newDestinationId = (int)$attach['result']['body']['attachment']['destination_id'];
        $this->tracker->trackDestination($newDestinationId);
        Assert::assertNotSame($retiredId, $newDestinationId);
        $retired = $this->row('publication_destinations', 'id = :id', [':id' => $retiredId]);
        $live = $this->row('publication_destinations', 'id = :id', [':id' => $newDestinationId]);
        Assert::assertNull($retired['course_resource_id']);
        Assert::assertSame((string)$pointer['course_resource_id'], $live['course_resource_id']);
        Assert::assertNull($live['owner_live']);
        Assert::assertCount(1, $this->attachmentRows($secondItem));
        Assert::assertSame([], $this->attachmentRows($firstItem));
    }

    /** @group protection */
    public function test20FollowRecollectsAttachmentAddedAfterDiscoveryAndRefreshesIt(ConcurrencyTester $I)
    {
        $owner = $this->item('follow-owner');
        $attachedX = $this->item('follow-existing-x');
        $attachedY = $this->item('follow-new-y', $this->offering, 'legacy_reuse');
        $oldPointer = $this->electronic('follow-old');
        $newPointer = $this->electronic('follow-new');
        $setup = new PublicationDestinationRegistry();
        $owned = $setup->registerOwned($owner, $oldPointer);
        $destinationId = (int)$owned['body']['destination']['id'];
        $this->tracker->trackDestination($destinationId);
        $this->tracker->insertPublicationState($owner);
        $this->tracker->insertPublicationState($attachedX);
        $this->tracker->insertPublicationState($attachedY);
        Assert::assertSame(200, $setup->attach($attachedX, $destinationId)['status']);
        $frozenBefore = [$this->itemInput($attachedX), $this->itemInput($attachedY)];
        $statesBefore = [$this->stateRow($attachedX), $this->stateRow($attachedY)];
        $eventsBefore = $this->workflowEventCount([$owner, $attachedX, $attachedY]);

        $aReady = $this->startOperation('follow-a', 'follow', [
            'destination_id' => $destinationId,
            'pointer' => $newPointer,
        ]);
        $this->assertWorkerReadyForDatabase($aReady);
        $firstDiscovery = $this->supervisor->awaitPhase('follow-a', 'discovered', 1);
        Assert::assertNotContains($attachedY['id'], $firstDiscovery['context']['required']['reuse_item_ids']);
        Assert::assertNotContains($attachedY['submission_id'], $firstDiscovery['context']['required']['submission_ids']);

        $attachY = $this->runOperation('follow-b-attach-y', 'attach_by_id', [
            'item' => $attachedY,
            'destination_id' => $destinationId,
        ]);
        $this->assertStatus($attachY, 200);
        $this->supervisor->release('follow-a', 'discovered', 1);
        $this->supervisor->awaitPhase('follow-a', 'locked', 1);
        $this->supervisor->release('follow-a', 'locked', 1);
        $secondDiscovery = $this->supervisor->awaitPhase('follow-a', 'discovered', 2);
        Assert::assertContains($attachedY['id'], $secondDiscovery['context']['required']['reuse_item_ids']);
        Assert::assertContains($attachedY['submission_id'], $secondDiscovery['context']['required']['submission_ids']);
        $follow = $this->supervisor->complete('follow-a');
        $this->assertStatus($follow, 200);
        $this->assertAttemptStages('follow-a', 2);

        $destination = $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]);
        Assert::assertSame((string)$newPointer['course_resource_id'], $destination['course_resource_id']);
        $attachments = array_merge($this->attachmentRows($attachedX), $this->attachmentRows($attachedY));
        Assert::assertCount(2, $attachments);
        foreach ($attachments as $attachment) {
            Assert::assertSame('1', (string)$attachment['live']);
            $snapshot = json_decode($attachment['attached_snapshot_json'], true);
            Assert::assertSame('electronic', $snapshot['destination_kind']);
            Assert::assertSame($newPointer['course_resource_id'], (int)$snapshot['course_resource_id']);
            Assert::assertSame($newPointer['resource_id'], (int)$snapshot['resource_id']);
            Assert::assertSame($this->tracker->fixture()->electronicResourceName('follow-new'), $snapshot['name']);
            Assert::assertSame('Synthetic live description follow-new', $snapshot['description']);
            Assert::assertSame('Synthetic public metadata follow-new', $snapshot['metadata'][0]['field_value']);
            Assert::assertSame('Synthetic public link follow-new', $snapshot['links'][0]['title']);
        }
        Assert::assertSame($frozenBefore, [$this->itemInput($attachedX), $this->itemInput($attachedY)]);
        Assert::assertSame($statesBefore, [$this->stateRow($attachedX), $this->stateRow($attachedY)]);
        Assert::assertSame($eventsBefore, $this->workflowEventCount([$owner, $attachedX, $attachedY]));
    }

    public function test20EqualCountAttachmentSubstitutionRestartsByMembership(ConcurrencyTester $I)
    {
        $owner = $this->item('equal-substitution-owner');
        $attachedX = $this->item('equal-substitution-x');
        $attachedY = $this->item('equal-substitution-y', $this->offering, 'legacy_reuse');
        $oldPointer = $this->electronic('equal-substitution-old');
        $newPointer = $this->electronic('equal-substitution-new');
        $setup = new PublicationDestinationRegistry();
        $owned = $setup->registerOwned($owner, $oldPointer);
        $destinationId = (int)$owned['body']['destination']['id'];
        $this->tracker->trackDestination($destinationId);
        Assert::assertSame(200, $setup->attach($attachedX, $destinationId)['status']);
        $attachmentX = $this->attachmentRows($attachedX)[0];
        $snapshotX = $attachmentX['attached_snapshot_json'];
        $snapshotY = [
            'destination_kind' => 'electronic',
            'course_resource_id' => $oldPointer['course_resource_id'],
            'resource_id' => $oldPointer['resource_id'],
            'name' => 'Synthetic pre-follow Y snapshot',
        ];

        $ready = $this->startOperation('equal-substitution-follow', 'follow', [
            'destination_id' => $destinationId,
            'pointer' => $newPointer,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $first = $this->supervisor->awaitPhase('equal-substitution-follow', 'discovered', 1);
        $oldMembers = $first['context']['required']['attachment_ids'];
        Assert::assertContains((int)$attachmentX['id'], $oldMembers);

        \Yii::$app->db->createCommand()->update('publication_attachments', [
            'live' => null,
            'detached_at' => '2026-10-15 12:00:00',
        ], ['id' => $attachmentX['id']])->execute();
        $attachmentYId = $this->tracker->insertAttachment($destinationId, $attachedY, $snapshotY);
        $this->supervisor->release('equal-substitution-follow', 'discovered', 1);
        $this->supervisor->awaitPhase('equal-substitution-follow', 'locked', 1);
        $this->supervisor->release('equal-substitution-follow', 'locked', 1);
        $second = $this->supervisor->awaitPhase('equal-substitution-follow', 'discovered', 2);
        $newMembers = $second['context']['required']['attachment_ids'];
        Assert::assertCount(count($oldMembers), $newMembers);
        Assert::assertNotContains((int)$attachmentX['id'], $newMembers);
        Assert::assertContains($attachmentYId, $newMembers);
        $this->supervisor->release('equal-substitution-follow', 'discovered', 2);
        $result = $this->supervisor->complete('equal-substitution-follow');
        $this->assertStatus($result, 200);
        $this->assertAttemptStages('equal-substitution-follow', 2);

        $detachedX = $this->attachmentRows($attachedX)[0];
        $liveY = $this->row('publication_attachments', 'id = :id', [':id' => $attachmentYId]);
        Assert::assertNull($detachedX['live']);
        Assert::assertSame($snapshotX, $detachedX['attached_snapshot_json']);
        Assert::assertSame('1', (string)$liveY['live']);
        $snapshot = json_decode($liveY['attached_snapshot_json'], true);
        Assert::assertSame($newPointer['course_resource_id'], (int)$snapshot['course_resource_id']);
        Assert::assertSame($newPointer['resource_id'], (int)$snapshot['resource_id']);
        Assert::assertSame($this->tracker->fixture()->electronicResourceName('equal-substitution-new'), $snapshot['name']);
    }

    /** @group protection */
    public function test21RetireLocksNewlyAttachedSubmissionsItemsStatesAndAttachments(ConcurrencyTester $I)
    {
        $existing = $this->item('retire-existing-new');
        $newlyAttached = $this->item('retire-newly-attached-reuse', $this->offering, 'legacy_reuse');
        $pointer = $this->electronic('retire-set-entry');
        $destinationId = $this->tracker->insertDestination($pointer);
        $setup = new PublicationDestinationRegistry();
        $this->tracker->insertPublicationState($existing);
        $this->tracker->insertPublicationState($newlyAttached);
        Assert::assertSame(200, $setup->attach($existing, $destinationId)['status']);
        $existingAttachment = $this->attachmentRows($existing)[0];
        $stateBefore = [$this->stateRow($existing), $this->stateRow($newlyAttached)];
        $inputBefore = [$this->itemInput($existing), $this->itemInput($newlyAttached)];
        $eventsBefore = $this->workflowEventCount([$existing, $newlyAttached]);
        $liveResourceBefore = $this->row(
            'resources', 'resource_id = :id', [':id' => $pointer['resource_id']]
        );

        $ready = $this->startOperation('retire-a', 'retire', ['destination_id' => $destinationId]);
        $this->assertWorkerReadyForDatabase($ready);
        $firstDiscovery = $this->supervisor->awaitPhase('retire-a', 'discovered', 1);
        Assert::assertNotContains(
            $newlyAttached['id'],
            $firstDiscovery['context']['required']['reuse_item_ids']
        );

        $attach = $this->runOperation('retire-b-attach-y', 'attach_by_id', [
            'item' => $newlyAttached,
            'destination_id' => $destinationId,
        ]);
        $this->assertStatus($attach, 200);
        $newAttachment = $this->attachmentRows($newlyAttached)[0];
        $this->supervisor->release('retire-a', 'discovered', 1);
        $this->supervisor->awaitPhase('retire-a', 'locked', 1);
        $this->supervisor->release('retire-a', 'locked', 1);
        $secondDiscovery = $this->supervisor->awaitPhase('retire-a', 'discovered', 2);
        Assert::assertContains($newlyAttached['id'], $secondDiscovery['context']['required']['reuse_item_ids']);
        $this->supervisor->awaitPhase('retire-a', 'locked', 2);

        $probeRows = [
            ['kind' => 'submission', 'id' => $newlyAttached['submission_id']],
            ['kind' => 'reuse_item', 'id' => $newlyAttached['id']],
            ['kind' => 'state', 'item_kind' => $newlyAttached['kind'], 'id' => $newlyAttached['id']],
            ['kind' => 'attachment', 'id' => $newAttachment['id']],
        ];
        $connections = [$ready['connection_id']];
        foreach ($probeRows as $index => $row) {
            $probe = $this->runOperation('retire-lock-probe-' . $index, 'lock_probe', ['row' => $row]);
            $connections[] = $probe['connection_id'];
            Assert::assertSame('contended', $probe['result']['outcome']);
            Assert::assertSame(1205, $probe['result']['mysql_code']);
        }
        $uncollected = $this->runOperation('retire-uncollected-offering', 'lock_probe', [
            'row' => ['kind' => 'offering', 'id' => $this->otherOffering],
        ]);
        $connections[] = $uncollected['connection_id'];
        Assert::assertSame('acquired', $uncollected['result']['outcome']);
        Assert::assertCount(count(array_unique($connections)), $connections);

        $this->supervisor->release('retire-a', 'locked', 2);
        $retire = $this->supervisor->complete('retire-a');
        $this->assertStatus($retire, 200);
        $this->assertAttemptStages('retire-a', 2);
        $this->assertSqlLockOrder($retire['queries'], [
            'course_offerings', 'resources', 'course_resources', 'publication_destinations',
            'faculty_submissions', 'submission_new_resources', 'submission_reuse_resources',
            'submission_publication_state', 'publication_attachments',
        ]);

        $destination = $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]);
        Assert::assertNull($destination['course_resource_id']);
        Assert::assertNotNull($destination['retired_at']);
        foreach ([$existing, $newlyAttached] as $item) {
            $attachment = $this->attachmentRows($item)[0];
            Assert::assertNull($attachment['live']);
            Assert::assertNotNull($attachment['detached_at']);
        }
        Assert::assertSame($existingAttachment['attached_snapshot_json'], $this->attachmentRows($existing)[0]['attached_snapshot_json']);
        Assert::assertSame($stateBefore, [$this->stateRow($existing), $this->stateRow($newlyAttached)]);
        Assert::assertSame($inputBefore, [$this->itemInput($existing), $this->itemInput($newlyAttached)]);
        Assert::assertSame($eventsBefore, $this->workflowEventCount([$existing, $newlyAttached]));
        Assert::assertSame($liveResourceBefore, $this->row(
            'resources', 'resource_id = :id', [':id' => $pointer['resource_id']]
        ));
    }

    /** @group protection */
    public function test22IdenticalLazyPointerAttachRaceReturnsOneUnchangedWinner(ConcurrencyTester $I)
    {
        $this->runIdenticalAttachRace(true);
    }

    /** @group protection */
    public function test22IdenticalExistingRegistryAttachRaceReturnsOneUnchangedWinner(ConcurrencyTester $I)
    {
        $this->runIdenticalAttachRace(false);
    }

    /** @group protection */
    public function test23IdenticalRegisterOwnedRaceReturnsTheCommittedUnregisteredEntryWinner(ConcurrencyTester $I)
    {
        $item = $this->item('register-race-owner');
        $pointer = $this->electronic('register-race-entry');
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $aReady = $this->startOperation('register-race-a', 'register_owned', [
            'item' => $item,
            'pointer' => $pointer,
            'session_timestamp' => 1793360000,
        ]);
        $bReady = $this->startOperation('register-race-b', 'register_owned', [
            'item' => $item,
            'pointer' => $pointer,
            'session_timestamp' => 1793440000,
        ]);
        $this->assertWorkersDistinct($aReady, $bReady);
        Assert::assertNotSame($aReady['session_time'], $bReady['session_time']);
        $this->supervisor->awaitPhase('register-race-a', 'discovered', 1);
        $this->supervisor->awaitPhase('register-race-b', 'discovered', 1);
        $this->supervisor->release('register-race-a', 'discovered', 1);
        $this->supervisor->awaitPhase('register-race-a', 'locked', 1);
        $this->supervisor->release('register-race-b', 'discovered', 1);
        $this->supervisor->release('register-race-a', 'locked', 1);
        $beforeCommit = $this->supervisor->advanceToPhase('register-race-a', 'before_commit');
        $this->supervisor->release('register-race-a', 'before_commit', $beforeCommit['attempt']);
        $this->supervisor->awaitPhase('register-race-a', 'committed', 1);
        $this->supervisor->awaitPhase('register-race-b', 'locked', 1);
        $winner = $this->rowForPointer($pointer);
        Assert::assertNotNull($winner);
        Assert::assertSame($aReady['session_time'], $winner['created_at']);
        Assert::assertSame($aReady['session_time'], $winner['updated_at']);

        $this->supervisor->release('register-race-b', 'locked', 1);
        $this->supervisor->release('register-race-a', 'committed', 1);
        $a = $this->supervisor->complete('register-race-a');
        $b = $this->supervisor->complete('register-race-b');
        $this->assertStatus($a, 200);
        $this->assertStatus($b, 200);
        $this->assertAttemptStages('register-race-a', 1);
        $this->assertAttemptStages('register-race-b', 1);
        $winnerId = (int)$winner['id'];
        $this->tracker->trackDestination($winnerId);
        Assert::assertSame($winnerId, (int)$a['result']['body']['destination']['id']);
        Assert::assertSame($winnerId, (int)$b['result']['body']['destination']['id']);
        Assert::assertSame($winner, $this->rowForPointer($pointer));
        Assert::assertSame(1, $this->destinationCountForPointer($pointer));
        Assert::assertSame([], $this->attachmentRows($item));
        Assert::assertSame($stateBefore, $this->stateRow($item));
    }

    /** @group protection */
    public function test26ForcedAttachmentDuplicateEntersRealRecoveryAndReturnsTheWinner(ConcurrencyTester $I)
    {
        $item = $this->item('forced-attach-recovery');
        $pointer = $this->electronic('forced-attach-entry');
        $destinationId = $this->tracker->insertDestination($pointer);
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $inputBefore = $this->itemInput($item);
        $aReady = $this->startOperation('attach-recovery-a', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationId,
        ]);
        $this->assertWorkerReadyForDatabase($aReady);
        $this->supervisor->awaitPhase('attach-recovery-a', 'discovered', 1);
        $this->supervisor->release('attach-recovery-a', 'discovered', 1);
        $this->supervisor->awaitPhase('attach-recovery-a', 'locked', 1);
        $this->supervisor->release('attach-recovery-a', 'locked', 1);
        $this->supervisor->awaitPhase('attach-recovery-a', 'before_insert', 1);

        $winnerResult = $this->insertCompetingAttachment(
            'attach-recovery-insert-winner',
            $destinationId,
            $item,
            'Synthetic competing content captured before recovery'
        );
        $winnerId = (int)$winnerResult['result']['id'];
        $winnerRow = $this->row('publication_attachments', 'id = :id', [':id' => $winnerId]);
        $this->supervisor->release('attach-recovery-a', 'before_insert', 1);
        $recovery = $this->supervisor->awaitPhase('attach-recovery-a', 'recovery_entered');
        Assert::assertSame(1062, (int)$recovery['context']['mysql_code']);
        Assert::assertSame('uq_pub_attach_item_live', $recovery['context']['constraint']);
        $this->supervisor->release('attach-recovery-a', 'recovery_entered', $recovery['attempt']);
        $recoveryLock = $this->supervisor->advanceToPhase('attach-recovery-a', 'locked');
        $this->supervisor->release('attach-recovery-a', 'locked', $recoveryLock['attempt']);
        $resolved = $this->supervisor->complete('attach-recovery-a');
        $this->assertStatus($resolved, 200);
        $this->assertContainsPhase('attach-recovery-a', 'recovery_entered');
        Assert::assertSame($winnerId, (int)$resolved['result']['body']['attachment']['id']);
        Assert::assertSame($winnerRow, $this->row('publication_attachments', 'id = :id', [':id' => $winnerId]));
        Assert::assertSame(1, $this->attachmentCount($item));
        Assert::assertSame($stateBefore, $this->stateRow($item));
        Assert::assertSame($inputBefore, $this->itemInput($item));
    }

    public function test27AttachRecoveryCompletesBeforeRetireThenRetireDetachesWinner(ConcurrencyTester $I)
    {
        $result = $this->runAttachRecoveryRetireSchedule(false);
        $this->assertStatus($result['attach'], 200);
        $this->assertStatus($result['retire'], 200);
        Assert::assertSame($result['injected_id'], (int)$result['attach']['result']['body']['attachment']['id']);
        Assert::assertNull($result['attachment_after']['live']);
        Assert::assertNotNull($result['attachment_after']['detached_at']);
        Assert::assertNotNull($result['destination_after']['retired_at']);
    }

    /** @group protection */
    public function test27RetireCompletesBeforeAttachRecoveryAndPreventsResurrection(ConcurrencyTester $I)
    {
        $result = $this->runAttachRecoveryRetireSchedule(true);
        $this->assertStatus($result['retire'], 200);
        $this->assertStatus($result['attach'], 409, 'destination_retired');
        Assert::assertNull($result['attachment_after']['live']);
        Assert::assertNotNull($result['destination_after']['retired_at']);
        Assert::assertNull($result['destination_after']['course_resource_id']);
    }

    public function test27PointerKeyRecoveryAfterRetireCreatesANewLiveRegistryRow(ConcurrencyTester $I)
    {
        $item = $this->item('pointer-recovery-item');
        $pointer = $this->electronic('pointer-recovery-entry');
        $aReady = $this->startOperation('pointer-recovery-a', 'attach_by_pointer', [
            'item' => $item,
            'pointer' => $pointer,
        ]);
        $this->assertWorkerReadyForDatabase($aReady);
        $this->supervisor->awaitPhase('pointer-recovery-a', 'discovered', 1);
        $this->supervisor->release('pointer-recovery-a', 'discovered', 1);
        $this->supervisor->awaitPhase('pointer-recovery-a', 'locked', 1);
        $this->supervisor->release('pointer-recovery-a', 'locked', 1);
        $this->supervisor->awaitPhase('pointer-recovery-a', 'before_insert', 1);

        $competitor = $this->insertCompetingDestination('pointer-recovery-insert-winner', $pointer);
        $retiredId = (int)$competitor['result']['id'];
        $this->tracker->trackDestination($retiredId);
        $this->supervisor->release('pointer-recovery-a', 'before_insert', 1);
        $recovery = $this->supervisor->awaitPhase('pointer-recovery-a', 'recovery_entered');
        Assert::assertSame(1062, (int)$recovery['context']['mysql_code']);

        $retire = $this->runOperation('pointer-recovery-retire', 'retire', ['destination_id' => $retiredId]);
        $this->assertStatus($retire, 200);
        $this->supervisor->release('pointer-recovery-a', 'recovery_entered', $recovery['attempt']);
        $recoveryDiscovery = $this->supervisor->advanceToPhase('pointer-recovery-a', 'discovered');
        $this->supervisor->release('pointer-recovery-a', 'discovered', $recoveryDiscovery['attempt']);
        $attach = $this->supervisor->complete('pointer-recovery-a');
        $this->assertStatus($attach, 200);
        $this->assertContainsPhase('pointer-recovery-a', 'recovery_entered');
        $newId = (int)$attach['result']['body']['attachment']['destination_id'];
        $this->tracker->trackDestination($newId);
        Assert::assertNotSame($retiredId, $newId);
        Assert::assertNull($this->row('publication_destinations', 'id = :id', [':id' => $retiredId])['course_resource_id']);
        Assert::assertSame((string)$pointer['course_resource_id'], $this->row(
            'publication_destinations', 'id = :id', [':id' => $newId]
        )['course_resource_id']);
    }

    public function test28RegisterOwnedDuplicateRecoveryLocksCurrentWinnerAndReturnsIt(ConcurrencyTester $I)
    {
        $item = $this->item('register-recovery-owner');
        $pointer = $this->electronic('register-recovery-entry');
        $this->tracker->insertPublicationState($item);
        $ready = $this->startOperation('register-recovery-a', 'register_owned', [
            'item' => $item,
            'pointer' => $pointer,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('register-recovery-a', 'discovered', 1);
        $this->supervisor->release('register-recovery-a', 'discovered', 1);
        $this->supervisor->awaitPhase('register-recovery-a', 'locked', 1);
        $this->supervisor->release('register-recovery-a', 'locked', 1);
        $this->supervisor->awaitPhase('register-recovery-a', 'before_insert', 1);

        $competitor = $this->insertCompetingDestination('register-recovery-winner', $pointer, [
            'owner_item_kind' => $item['kind'],
            'owner_item_id' => $item['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $winnerId = (int)$competitor['result']['id'];
        $this->tracker->trackDestination($winnerId);
        $winner = $this->row('publication_destinations', 'id = :id', [':id' => $winnerId]);
        $this->supervisor->release('register-recovery-a', 'before_insert', 1);
        $recovery = $this->supervisor->awaitPhase('register-recovery-a', 'recovery_entered');
        Assert::assertSame(1062, (int)$recovery['context']['mysql_code']);
        $this->supervisor->release('register-recovery-a', 'recovery_entered', $recovery['attempt']);
        $recoveryLock = $this->supervisor->advanceToPhase('register-recovery-a', 'locked');
        $this->supervisor->release('register-recovery-a', 'locked', $recoveryLock['attempt']);
        $result = $this->supervisor->complete('register-recovery-a');
        $this->assertStatus($result, 200);
        $this->assertContainsPhase('register-recovery-a', 'recovery_entered');
        Assert::assertSame($winnerId, (int)$result['result']['body']['destination']['id']);
        Assert::assertSame($winner, $this->row('publication_destinations', 'id = :id', [':id' => $winnerId]));
        Assert::assertSame(1, $this->destinationCountForPointer($pointer));
        Assert::assertSame([], $this->attachmentRows($item));
        $this->assertSqlLockOrder($result['queries'], [
            'course_offerings', 'resources', 'course_resources', 'publication_destinations',
            'faculty_submissions', 'submission_new_resources', 'submission_publication_state',
        ]);
    }

    public function test28FollowDuplicateRecoveryReturnsOccupiedWithoutMovingTheDestination(ConcurrencyTester $I)
    {
        $owner = $this->item('follow-recovery-owner');
        $oldPointer = $this->electronic('follow-recovery-old');
        $newPointer = $this->electronic('follow-recovery-new');
        $owned = (new PublicationDestinationRegistry())->registerOwned($owner, $oldPointer);
        $destinationId = (int)$owned['body']['destination']['id'];
        $this->tracker->trackDestination($destinationId);
        $oldRow = $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]);

        $ready = $this->startOperation('follow-recovery-a', 'follow', [
            'destination_id' => $destinationId,
            'pointer' => $newPointer,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('follow-recovery-a', 'discovered', 1);
        $this->supervisor->release('follow-recovery-a', 'discovered', 1);
        $this->supervisor->awaitPhase('follow-recovery-a', 'locked', 1);
        $this->supervisor->release('follow-recovery-a', 'locked', 1);
        $this->supervisor->awaitPhase('follow-recovery-a', 'before_insert', 1);
        $competitor = $this->insertCompetingDestination('follow-recovery-conflict', $newPointer);
        $this->tracker->trackDestination((int)$competitor['result']['id']);
        $this->supervisor->release('follow-recovery-a', 'before_insert', 1);
        $recovery = $this->supervisor->awaitPhase('follow-recovery-a', 'recovery_entered');
        Assert::assertSame(1062, (int)$recovery['context']['mysql_code']);
        $this->supervisor->release('follow-recovery-a', 'recovery_entered', $recovery['attempt']);
        $recoveryLock = $this->supervisor->advanceToPhase('follow-recovery-a', 'locked');
        $this->supervisor->release('follow-recovery-a', 'locked', $recoveryLock['attempt']);
        $result = $this->supervisor->complete('follow-recovery-a');
        $this->assertStatus($result, 409, 'destination_occupied');
        $this->assertContainsPhase('follow-recovery-a', 'recovery_entered');
        Assert::assertSame($oldRow, $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]));
        Assert::assertSame((string)$oldPointer['course_resource_id'], $oldRow['course_resource_id']);
        Assert::assertSame(1, $this->destinationCountForPointer($oldPointer));
        Assert::assertSame(1, $this->destinationCountForPointer($newPointer));
        $this->assertSqlLockOrder($result['queries'], [
            'course_offerings', 'resources', 'course_resources', 'publication_destinations',
            'faculty_submissions', 'submission_new_resources',
        ]);
    }

    /** @group protection */
    public function test28UnrelatedIntegrityFailurePropagatesWithoutRecoveryMapping(ConcurrencyTester $I)
    {
        $item = $this->item('unrelated-integrity-owner');
        $pointer = $this->electronic('unrelated-integrity-entry');
        $destinationId = $this->tracker->insertDestination($pointer);
        $trigger = 'api116b1_fail_' . substr(md5(uniqid('', true)), 0, 8);
        \Yii::$app->db->createCommand(
            'CREATE TRIGGER ' . $trigger . ' BEFORE INSERT ON publication_attachments '
            . 'FOR EACH ROW SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "Synthetic unrelated registry failure"'
        )->execute();
        try {
            $ready = $this->startOperation('unrelated-integrity-a', 'attach_by_id', [
                'item' => $item,
                'destination_id' => $destinationId,
            ]);
            $this->assertWorkerReadyForDatabase($ready);
            $this->supervisor->awaitPhase('unrelated-integrity-a', 'discovered', 1);
            $this->supervisor->release('unrelated-integrity-a', 'discovered', 1);
            $this->supervisor->awaitPhase('unrelated-integrity-a', 'locked', 1);
            $this->supervisor->release('unrelated-integrity-a', 'locked', 1);
            $this->supervisor->awaitPhase('unrelated-integrity-a', 'before_insert', 1);
            $this->supervisor->release('unrelated-integrity-a', 'before_insert', 1);
            $this->expectSupervisorFailure(function () {
                $this->supervisor->complete('unrelated-integrity-a');
            }, 'Synthetic unrelated registry failure');
            Assert::assertNotContains('recovery_entered', $this->phases('unrelated-integrity-a'));
            Assert::assertSame([], $this->attachmentRows($item));
        } finally {
            $this->supervisor->stopAll();
            \Yii::$app->db->createCommand('DROP TRIGGER IF EXISTS ' . $trigger)->execute();
        }
    }

    public function test29ChangedSubmissionOfferingIsReadAfterLocksAndReturnsCurrentMismatch(ConcurrencyTester $I)
    {
        $item = $this->item('stale-submission-offering');
        $pointer = $this->electronic('stale-submission-entry');
        $destinationId = $this->tracker->insertDestination($pointer);
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $ready = $this->startOperation('stale-offering-a', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationId,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('stale-offering-a', 'discovered', 1);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'offering_id' => $this->otherOffering,
        ], ['submission_id' => $item['submission_id']])->execute();
        $secondDiscovery = $this->supervisor->advanceToPhase('stale-offering-a', 'discovered');
        Assert::assertSame(2, (int)$secondDiscovery['attempt']);
        Assert::assertContains($this->otherOffering, $secondDiscovery['context']['required']['offering_ids']);
        $this->supervisor->release('stale-offering-a', 'discovered', 2);
        $result = $this->supervisor->complete('stale-offering-a');
        $this->assertStatus($result, 409, 'offering_mismatch');
        $this->assertAttemptStages('stale-offering-a', 2);
        Assert::assertSame($stateBefore, $this->stateRow($item));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    public function test29ChangedItemIdentityIsValidatedFromTheCurrentLockedRow(ConcurrencyTester $I)
    {
        $item = $this->item('stale-item-identity');
        $oldInstance = $this->instanceId();
        $newInstance = $this->instanceId();
        $this->setIdentity($item, $oldInstance);
        $pointer = $this->physical('stale-item-physical', $oldInstance);
        $destinationId = $this->tracker->insertDestination($pointer);
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $ready = $this->startOperation('stale-item-a', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationId,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('stale-item-a', 'discovered', 1);
        $this->setIdentity($item, $newInstance);
        $this->supervisor->release('stale-item-a', 'discovered', 1);
        $result = $this->supervisor->complete('stale-item-a');
        $this->assertStatus($result, 409, 'destination_unresolved');
        $this->assertAttemptStages('stale-item-a', 1);
        Assert::assertSame($stateBefore, $this->stateRow($item));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    public function test29NewOwnerConflictFoundAfterDiscoveryRestartsAndWins(ConcurrencyTester $I)
    {
        $item = $this->item('stale-owner-conflict');
        $pointerA = $this->electronic('stale-owner-a');
        $pointerB = $this->electronic('stale-owner-b');
        $ready = $this->startOperation('stale-owner-a-worker', 'register_owned', [
            'item' => $item,
            'pointer' => $pointerA,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('stale-owner-a-worker', 'discovered', 1);
        $winner = $this->runOperation('stale-owner-b-worker', 'register_owned', [
            'item' => $item,
            'pointer' => $pointerB,
        ]);
        $this->assertStatus($winner, 200);
        $winnerId = (int)$winner['result']['body']['destination']['id'];
        $this->tracker->trackDestination($winnerId);
        $this->supervisor->release('stale-owner-a-worker', 'discovered', 1);
        $secondDiscovery = $this->supervisor->advanceToPhase('stale-owner-a-worker', 'discovered');
        Assert::assertSame(2, (int)$secondDiscovery['attempt']);
        Assert::assertContains($winnerId, $secondDiscovery['context']['required']['destination_ids']);
        $this->supervisor->release('stale-owner-a-worker', 'discovered', 2);
        $result = $this->supervisor->complete('stale-owner-a-worker');
        $this->assertStatus($result, 409, 'item_already_owns');
        $this->assertAttemptStages('stale-owner-a-worker', 2);
        Assert::assertNull($this->rowForPointer($pointerA));
        Assert::assertSame($winnerId, (int)$this->rowForPointer($pointerB)['id']);
    }

    public function test29NewAttachmentConflictFoundAfterDiscoveryRestartsAndWins(ConcurrencyTester $I)
    {
        $item = $this->item('stale-attachment-conflict');
        $pointerA = $this->electronic('stale-attachment-a');
        $pointerB = $this->electronic('stale-attachment-b');
        $destinationA = $this->tracker->insertDestination($pointerA);
        $destinationB = $this->tracker->insertDestination($pointerB);
        $ready = $this->startOperation('stale-attachment-a-worker', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationA,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('stale-attachment-a-worker', 'discovered', 1);
        $winner = $this->runOperation('stale-attachment-b-worker', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationB,
        ]);
        $this->assertStatus($winner, 200);
        $this->supervisor->release('stale-attachment-a-worker', 'discovered', 1);
        $secondDiscovery = $this->supervisor->advanceToPhase('stale-attachment-a-worker', 'discovered');
        Assert::assertSame(2, (int)$secondDiscovery['attempt']);
        Assert::assertContains($destinationB, $secondDiscovery['context']['required']['destination_ids']);
        $this->supervisor->release('stale-attachment-a-worker', 'discovered', 2);
        $result = $this->supervisor->complete('stale-attachment-a-worker');
        $this->assertStatus($result, 409, 'item_already_attached');
        $this->assertAttemptStages('stale-attachment-a-worker', 2);
        $rows = $this->attachmentRows($item);
        Assert::assertCount(1, $rows);
        Assert::assertSame((string)$destinationB, $rows[0]['destination_id']);
    }

    public function test29ChangedResourceChildrenAndFolderProduceTheCurrentAttachmentSnapshot(ConcurrencyTester $I)
    {
        $item = $this->item('stale-resource-snapshot');
        $pointer = $this->electronic('stale-resource-live');
        $folderName = 'Synthetic folder before attach';
        \Yii::$app->db->createCommand()->insert('folders', ['name' => $folderName])->execute();
        $folderId = (int)\Yii::$app->db->getLastInsertID();
        $this->tracker->trackFolder($folderId);
        \Yii::$app->db->createCommand()->update('resources', [
            'folder_id' => $folderId,
        ], ['resource_id' => $pointer['resource_id']])->execute();
        $metadata = $this->row('resource_metadata', 'resource_id = :id', [':id' => $pointer['resource_id']]);
        $link = $this->row('resource_links', 'resource_id = :id', [':id' => $pointer['resource_id']]);

        $ready = $this->startOperation('stale-resource-a', 'attach_by_pointer', [
            'item' => $item,
            'pointer' => $pointer,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('stale-resource-a', 'discovered', 1);
        \Yii::$app->db->createCommand()->update('resources', [
            'name' => 'Synthetic changed live name',
            'description' => 'Synthetic changed live description',
        ], ['resource_id' => $pointer['resource_id']])->execute();
        \Yii::$app->db->createCommand()->update('resource_metadata', [
            'field_value' => 'Synthetic changed public metadata',
        ], ['metadata_id' => $metadata['metadata_id']])->execute();
        \Yii::$app->db->createCommand()->update('resource_links', [
            'title' => 'Synthetic changed public link',
        ], ['link_id' => $link['link_id']])->execute();
        \Yii::$app->db->createCommand()->update('folders', [
            'name' => 'Synthetic folder after attach discovery',
        ], ['folder_id' => $folderId])->execute();

        $this->supervisor->release('stale-resource-a', 'discovered', 1);
        $result = $this->supervisor->complete('stale-resource-a');
        $this->assertStatus($result, 200);
        $this->assertAttemptStages('stale-resource-a', 1);
        $attachment = $this->attachmentRows($item)[0];
        $snapshot = json_decode($attachment['attached_snapshot_json'], true);
        Assert::assertSame('Synthetic changed live name', $snapshot['name']);
        Assert::assertSame('Synthetic changed live description', $snapshot['description']);
        Assert::assertSame('Synthetic changed public metadata', $snapshot['metadata'][0]['field_value']);
        Assert::assertSame('Synthetic changed public link', $snapshot['links'][0]['title']);
        Assert::assertSame('Synthetic folder after attach discovery', $snapshot['folder_name']);
    }

    public function test29NewPhysicalAmbiguityAfterDiscoveryRestartsAndReturnsCurrentError(ConcurrencyTester $I)
    {
        $item = $this->item('stale-physical-ambiguity');
        $instance = $this->instanceId();
        $this->setIdentity($item, $instance);
        $pointer = $this->physical('stale-physical-candidate-one', $instance);
        $destinationId = $this->tracker->insertDestination($pointer);
        $ready = $this->startOperation('stale-physical-a', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationId,
        ]);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->awaitPhase('stale-physical-a', 'discovered', 1);
        $secondPointer = $this->physical('stale-physical-candidate-two', $instance);
        $this->supervisor->release('stale-physical-a', 'discovered', 1);
        $secondDiscovery = $this->supervisor->advanceToPhase('stale-physical-a', 'discovered');
        Assert::assertSame(2, (int)$secondDiscovery['attempt']);
        Assert::assertContains(
            $secondPointer['physical_reference_id'],
            $secondDiscovery['context']['required']['physical_reference_ids']
        );
        $this->supervisor->release('stale-physical-a', 'discovered', 2);
        $result = $this->supervisor->complete('stale-physical-a');
        $this->assertStatus($result, 409, 'destination_ambiguous');
        $this->assertAttemptStages('stale-physical-a', 2);
        Assert::assertSame([], $this->attachmentRows($item));
    }

    private function runAttachRecoveryRetireSchedule($retireFirst)
    {
        $item = $this->item($retireFirst ? 'recovery-retire-first-item' : 'recovery-first-item');
        $pointer = $this->electronic($retireFirst ? 'recovery-retire-first-entry' : 'recovery-first-entry');
        $destinationId = $this->tracker->insertDestination($pointer);
        $this->tracker->insertPublicationState($item);
        $aReady = $this->startOperation('recovery-attach-a', 'attach_by_id', [
            'item' => $item,
            'destination_id' => $destinationId,
        ]);
        $this->assertWorkerReadyForDatabase($aReady);
        $this->supervisor->awaitPhase('recovery-attach-a', 'discovered', 1);
        $this->supervisor->release('recovery-attach-a', 'discovered', 1);
        $this->supervisor->awaitPhase('recovery-attach-a', 'locked', 1);
        $this->supervisor->release('recovery-attach-a', 'locked', 1);
        $this->supervisor->awaitPhase('recovery-attach-a', 'before_insert', 1);
        $injected = $this->insertCompetingAttachment(
            'recovery-competing-attachment',
            $destinationId,
            $item,
            'Synthetic recovery winner ' . ($retireFirst ? 'retire-first' : 'recovery-first')
        );
        $injectedId = (int)$injected['result']['id'];
        $this->supervisor->release('recovery-attach-a', 'before_insert', 1);
        $recovery = $this->supervisor->awaitPhase('recovery-attach-a', 'recovery_entered');
        Assert::assertSame(1062, (int)$recovery['context']['mysql_code']);

        if ($retireFirst) {
            $retire = $this->runOperation('recovery-retire-b', 'retire', ['destination_id' => $destinationId]);
            $this->assertStatus($retire, 200);
            $this->supervisor->release('recovery-attach-a', 'recovery_entered', $recovery['attempt']);
            $attach = $this->supervisor->complete('recovery-attach-a');
        } else {
            $this->supervisor->release('recovery-attach-a', 'recovery_entered', $recovery['attempt']);
            $recoveryLock = $this->supervisor->advanceToPhase('recovery-attach-a', 'locked');
            $retireReady = $this->startOperation('recovery-retire-b', 'retire', [
                'destination_id' => $destinationId,
            ]);
            $this->assertWorkerReadyForDatabase($retireReady);
            $this->supervisor->awaitPhase('recovery-retire-b', 'discovered', 1);
            $this->supervisor->release('recovery-retire-b', 'discovered', 1);
            $this->supervisor->release('recovery-attach-a', 'locked', $recoveryLock['attempt']);
            $beforeCommit = $this->supervisor->advanceToPhase('recovery-attach-a', 'before_commit');
            $this->supervisor->release('recovery-attach-a', 'before_commit', $beforeCommit['attempt']);
            $attach = $this->supervisor->complete('recovery-attach-a');
            $retire = $this->supervisor->complete('recovery-retire-b');
            $this->assertStatus($retire, 200);
        }

        $this->assertContainsPhase('recovery-attach-a', 'recovery_entered');
        $attachmentRows = $this->attachmentRows($item);
        Assert::assertCount(1, $attachmentRows);
        return [
            'attach' => $attach,
            'retire' => $retire,
            'injected_id' => $injectedId,
            'attachment_after' => $attachmentRows[0],
            'destination_after' => $this->row('publication_destinations', 'id = :id', [':id' => $destinationId]),
        ];
    }

    private function runIdenticalAttachRace($lazyPointer)
    {
        $item = $this->item($lazyPointer ? 'lazy-attach-race-item' : 'registered-attach-race-item');
        $pointer = $this->electronic($lazyPointer ? 'lazy-attach-race-entry' : 'registered-attach-race-entry');
        $destinationId = $lazyPointer ? null : $this->tracker->insertDestination($pointer);
        $this->tracker->insertPublicationState($item);
        $operation = $lazyPointer ? 'attach_by_pointer' : 'attach_by_id';
        $arguments = $lazyPointer ? ['pointer' => $pointer] : ['destination_id' => $destinationId];
        $aReady = $this->startOperation('identical-attach-a', $operation, array_merge($arguments, [
            'item' => $item,
            'session_timestamp' => 1793360000,
        ]));
        $bReady = $this->startOperation('identical-attach-b', $operation, array_merge($arguments, [
            'item' => $item,
            'session_timestamp' => 1793440000,
        ]));
        $this->assertWorkersDistinct($aReady, $bReady);
        Assert::assertNotSame($aReady['session_time'], $bReady['session_time']);
        $this->supervisor->awaitPhase('identical-attach-a', 'discovered', 1);
        $this->supervisor->awaitPhase('identical-attach-b', 'discovered', 1);
        $this->supervisor->release('identical-attach-a', 'discovered', 1);
        $this->supervisor->awaitPhase('identical-attach-a', 'locked', 1);
        $this->supervisor->release('identical-attach-b', 'discovered', 1);
        $this->supervisor->release('identical-attach-a', 'locked', 1);
        $beforeCommit = $this->supervisor->advanceToPhase('identical-attach-a', 'before_commit');
        $this->supervisor->release('identical-attach-a', 'before_commit', $beforeCommit['attempt']);
        $this->supervisor->awaitPhase('identical-attach-a', 'committed', 1);
        $this->supervisor->awaitPhase('identical-attach-b', 'locked', 1);
        $winnerRows = $this->attachmentRows($item);
        Assert::assertCount(1, $winnerRows);
        $winner = $winnerRows[0];
        Assert::assertSame($aReady['session_time'], $winner['attached_at']);
        Assert::assertSame($aReady['session_time'], $winner['updated_at']);
        Assert::assertNotSame('', $winner['attached_snapshot_json']);
        $winnerDestination = $this->row('publication_destinations', 'id = :id', [
            ':id' => $winner['destination_id'],
        ]);
        Assert::assertSame($aReady['session_time'], $winnerDestination['created_at']);
        Assert::assertSame($aReady['session_time'], $winnerDestination['updated_at']);

        $this->supervisor->release('identical-attach-b', 'locked', 1);
        $this->supervisor->release('identical-attach-a', 'committed', 1);
        $a = $this->supervisor->complete('identical-attach-a');
        $b = $this->supervisor->complete('identical-attach-b');
        $this->assertStatus($a, 200);
        $this->assertStatus($b, 200);
        $this->assertAttemptStages('identical-attach-a', 1);
        $this->assertAttemptStages('identical-attach-b', 1);
        Assert::assertSame((int)$winner['id'], (int)$a['result']['body']['attachment']['id']);
        Assert::assertSame((int)$winner['id'], (int)$b['result']['body']['attachment']['id']);
        Assert::assertSame($winner, $this->attachmentRows($item)[0]);
        Assert::assertCount(1, $this->attachmentRows($item));
        Assert::assertSame($winnerDestination, $this->row('publication_destinations', 'id = :id', [
            ':id' => $winnerDestination['id'],
        ]));
        $this->tracker->trackDestination((int)$winnerDestination['id']);
    }

    private function setIdentity(array $item, $instanceId)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $column = $item['kind'] === 'new' ? 'resource_data' : 'source_snapshot_json';
        $frozenInput = [
            'version' => 1,
            'title' => 'Synthetic frozen input',
            'eds' => ['an' => Api116AFixture::accession($instanceId)],
        ];
        $values = [
            $column => json_encode($frozenInput),
            'staff_corrections_json' => '{"title":"Synthetic correction"}',
        ];
        if ($item['kind'] === 'new') {
            $values['resource_data'] = json_encode([
                'title' => 'Synthetic draft input',
                'eds' => ['an' => Api116AFixture::accession($instanceId)],
            ]);
            $values['source_snapshot_json'] = json_encode([
                'version' => 1,
                'title' => 'Synthetic frozen input',
            ]);
        }
        \Yii::$app->db->createCommand()->update($table, $values, ['id' => $item['id']])->execute();
    }

    private function item($suffix, $offeringId = null, $representation = 'new')
    {
        $item = $this->tracker->fixture()->createItem(
            $suffix,
            $offeringId === null ? $this->offering : $offeringId,
            $representation
        );
        $this->tracker->trackItem($item);
        return $item;
    }

    private function electronic($suffix, $offeringId = null)
    {
        $pointer = $this->tracker->fixture()->createElectronicDestination(
            $offeringId === null ? $this->offering : $offeringId,
            $suffix
        );
        $this->tracker->trackPointer($pointer);
        return $pointer;
    }

    private function physical($suffix, $instance, $offeringId = null)
    {
        $pointer = $this->tracker->fixture()->createPhysicalDestination(
            $offeringId === null ? $this->offering : $offeringId,
            $suffix,
            $instance
        );
        $this->tracker->trackPointer($pointer);
        return $pointer;
    }

    private function startOperation($label, $operation, array $payload)
    {
        $payload['op'] = $operation;
        $payload['manifest'] = $this->tracker->manifest();
        $this->supervisor->start($label, $payload);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        $this->assertWorkerReadyForDatabase($ready);
        $this->supervisor->release($label, 'ready', 0);
        return $ready;
    }

    private function runOperation($label, $operation, array $payload)
    {
        $ready = $this->startOperation($label, $operation, $payload);
        $result = $this->supervisor->complete($label);
        $result['connection_id'] = (int)$ready['connection_id'];
        return $result;
    }

    private function insertCompetingAttachment($label, $destinationId, array $item, $name)
    {
        $values = [
            'destination_id' => $destinationId,
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'attached_snapshot_json' => json_encode([
                'destination_kind' => 'electronic',
                'name' => $name,
                'metadata' => [['field_name' => 'race-content', 'field_value' => $name]],
                'links' => [['title' => $name]],
            ], JSON_UNESCAPED_SLASHES),
            'attached_at' => '2026-10-02 03:04:05',
            'updated_at' => '2026-10-02 06:07:08',
            'live' => 1,
        ];
        return $this->runOperation($label, 'insert_competing_row', [
            'table' => 'publication_attachments',
            'values' => $values,
        ]);
    }

    private function insertCompetingDestination($label, array $pointer, array $overrides = [])
    {
        $values = array_merge([
            'destination_kind' => $pointer['destination_kind'],
            'course_resource_id' => $pointer['destination_kind'] === 'electronic'
                ? $pointer['course_resource_id'] : null,
            'physical_reference_id' => $pointer['destination_kind'] === 'physical'
                ? $pointer['physical_reference_id'] : null,
            'offering_id' => $pointer['offering_id'],
            'origin_offering_id' => $pointer['offering_id'],
            'owner_item_kind' => null,
            'owner_item_id' => null,
            'owner_live' => null,
            'ownership_source' => 'none',
        ], $overrides);
        return $this->runOperation($label, 'insert_competing_row', [
            'table' => 'publication_destinations',
            'values' => $values,
        ]);
    }

    private function assertWorkerReadyForDatabase(array $ready)
    {
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('reserves_test', $ready['database']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        Assert::assertSame(10, (int)$ready['lock_wait_timeout']);
    }

    private function assertWorkersDistinct(array ...$workers)
    {
        $ids = [$this->parentConnectionId];
        foreach ($workers as $worker) {
            $ids[] = (int)$worker['connection_id'];
        }
        Assert::assertCount(count($ids), array_unique($ids));
    }

    private function assertStatus(array $frame, $status, $errorCode = null)
    {
        Assert::assertSame($status, $frame['result']['status']);
        if ($errorCode !== null) {
            Assert::assertSame($errorCode, $frame['result']['body']['error_code']);
        }
    }

    private function expectSupervisorFailure(callable $callback, $message)
    {
        try {
            call_user_func($callback);
            Assert::fail('Expected concurrency harness failure containing: ' . $message);
        } catch (\RuntimeException $exception) {
            Assert::assertNotFalse(strpos($exception->getMessage(), $message));
        }
    }

    private function phases($label)
    {
        return array_column($this->supervisor->history($label), 'phase');
    }

    private function assertContainsPhase($label, $phase)
    {
        Assert::assertContains($phase, $this->phases($label));
    }

    private function assertAttemptStages($label, $attempt)
    {
        $phases = [];
        foreach ($this->supervisor->history($label) as $frame) {
            if ((int)$frame['attempt'] === (int)$attempt) {
                $phases[] = $frame['phase'];
            }
        }
        Assert::assertSame(1, count(array_keys($phases, 'discovered', true)), 'One discovery per attempt.');
        Assert::assertSame(1, count(array_keys($phases, 'locked', true)), 'One complete lock call per attempt.');
        Assert::assertSame(1, count(array_keys($phases, 'before_commit', true)), 'The attempt reaches commit only once.');
        Assert::assertSame(1, count(array_keys($phases, 'committed', true)), 'Commit is reported only after commit.');
        Assert::assertTrue(array_search('discovered', $phases, true) < array_search('locked', $phases, true));
        Assert::assertTrue(array_search('locked', $phases, true) < array_search('before_commit', $phases, true));
        Assert::assertTrue(array_search('before_commit', $phases, true) < array_search('committed', $phases, true));
    }

    private function assertProbeAttempt(PublicationDestinationConcurrencyRecordingProbe $probe, $attempt)
    {
        $events = $this->probeEventsForAttempt($probe, $attempt);
        $phases = array_column($events, 'phase');
        foreach (['discovered', 'locked', 'before_commit', 'committed'] as $required) {
            Assert::assertSame(1, count(array_keys($phases, $required, true)));
        }
        Assert::assertTrue(array_search('discovered', $phases, true) < array_search('locked', $phases, true));
        Assert::assertTrue(array_search('locked', $phases, true) < array_search('before_commit', $phases, true));
        Assert::assertTrue(array_search('before_commit', $phases, true) < array_search('committed', $phases, true));
        foreach ($phases as $phase) {
            Assert::assertContains($phase, [
                'discovered', 'locked', 'before_insert', 'before_commit', 'committed',
            ]);
        }
    }

    private function probeEventsForAttempt(PublicationDestinationConcurrencyRecordingProbe $probe, $attempt)
    {
        return array_values(array_filter($probe->events, function ($event) use ($attempt) {
            return (int)$event['attempt'] === (int)$attempt;
        }));
    }

    private function probePhases(PublicationDestinationConcurrencyRecordingProbe $probe)
    {
        return array_column($probe->events, 'phase');
    }

    private function stateCoverageKeys(array $items)
    {
        $keys = [];
        foreach ($items as $item) {
            if (is_array($item) && isset($item['kind'], $item['id'])) {
                $keys[] = $item['kind'] . ':' . $item['id'];
            }
        }
        return $keys;
    }

    private function recordingProbe()
    {
        return new class implements PublicationDestinationProbe {
            public $events = [];

            public function checkpoint($phase, $attempt, array $context = [])
            {
                $this->events[] = [
                    'phase' => $phase,
                    'attempt' => (int)$attempt,
                    'context' => $context,
                ];
            }
        };
    }

    private function normalizeCoverage(array $coverage)
    {
        ksort($coverage);
        foreach ($coverage as &$members) {
            if (is_array($members)) {
                foreach ($members as &$member) {
                    if (is_array($member)) {
                        ksort($member);
                    }
                }
                unset($member);
                usort($members, function ($left, $right) {
                    return strcmp(json_encode($left), json_encode($right));
                });
            }
        }
        unset($members);
        return $coverage;
    }

    private function assertSqlLockOrder(array $queries, array $expectedTables)
    {
        $ranks = [
            'course_offerings' => 0,
            'resources' => 1,
            'resource_metadata' => 2,
            'resource_links' => 2,
            'folders' => 2,
            'course_resources' => 3,
            'physical_resource_references' => 4,
            'publication_destinations' => 5,
            'faculty_submissions' => 6,
            'submission_new_resources' => 7,
            'submission_reuse_resources' => 8,
            'submission_publication_state' => 9,
            'publication_attachments' => 10,
        ];
        $firstTables = [];
        $seen = [];
        foreach ($queries as $query) {
            if (stripos($query, 'FOR UPDATE') === false
                || !preg_match('/\bFROM\s+`?([a-z_]+)`?/i', $query, $match)) {
                continue;
            }
            $table = strtolower($match[1]);
            if (!isset($seen[$table])) {
                $seen[$table] = true;
                $firstTables[] = $table;
            }
        }
        $orderedRanks = [];
        foreach ($firstTables as $table) {
            Assert::assertArrayHasKey($table, $ranks, 'Unexpected locking read table: ' . $table);
            $orderedRanks[] = $ranks[$table];
        }
        $sortedRanks = $orderedRanks;
        sort($sortedRanks, SORT_NUMERIC);
        Assert::assertSame($sortedRanks, $orderedRanks, 'First acquisitions must follow the contract order.');
        foreach ($expectedTables as $table) {
            Assert::assertContains($table, $firstTables, 'Missing real FOR UPDATE for ' . $table . '.');
        }
    }

    private function itemInput(array $item)
    {
        return $this->tracker->fixture()->itemRow($item);
    }

    private function stateRow(array $item)
    {
        return $this->row(
            'submission_publication_state',
            'item_kind = :kind AND item_id = :id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        );
    }

    private function attachmentRows(array $item)
    {
        $tableRows = \Yii::$app->db->createCommand(
            'SELECT * FROM publication_attachments WHERE item_kind = :kind AND item_id = :id ORDER BY id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryAll();
        return $tableRows;
    }

    private function attachmentCount(array $item)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM publication_attachments WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryScalar();
    }

    private function destinationCountForPointer(array $pointer)
    {
        $column = $pointer['destination_kind'] === 'electronic'
            ? 'course_resource_id' : 'physical_reference_id';
        $id = $pointer[$column];
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM publication_destinations WHERE `' . $column . '` = :id',
            [':id' => $id]
        )->queryScalar();
    }

    private function rowForPointer(array $pointer)
    {
        $column = $pointer['destination_kind'] === 'electronic'
            ? 'course_resource_id' : 'physical_reference_id';
        $id = $pointer[$column];
        return $this->row('publication_destinations', '`' . $column . '` = :id', [':id' => $id]);
    }

    private function row($table, $where, array $params)
    {
        $row = \Yii::$app->db->createCommand(
            'SELECT * FROM `' . $table . '` WHERE ' . $where,
            $params
        )->queryOne();
        return $row === false ? null : $row;
    }

    private function workflowEventCount(array $items)
    {
        $count = 0;
        foreach ($items as $item) {
            $count += (int)\Yii::$app->db->createCommand(
                'SELECT COUNT(*) FROM workflow_events WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryScalar();
        }
        return $count;
    }

    private function courseCount($courseNumber)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM courses WHERE course_number = :number', [':number' => $courseNumber]
        )->queryScalar();
    }

    private function courseCountLike($pattern)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM courses WHERE course_number LIKE :pattern', [':pattern' => $pattern]
        )->queryScalar();
    }

    private function instanceId()
    {
        return '10000000-0000-4000-8000-' . substr(md5(uniqid('', true)), 0, 12);
    }
}

<?php

require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use PHPUnit\Framework\Assert;
use app\services\FacultyItemEvidenceReader;

class Api119EItemEvidenceCest extends Api116ADestinationRegistryTestBase
{
    private $commandClass;
    private $emptyItem;
    private $reuseNoPointer;
    private $reviewOnlyItem;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->commandClass = \Yii::$app->db->commandClass;
        \Yii::$app->db->commandClass = Api119A2FailingCommand::class;
        Api119A2FailingCommand::clearConfiguration();

        $this->emptyItem = $this->fixtures->createItem('evidence-empty', $this->offering);
        foreach ([$this->owner, $this->attached, $this->otherItem] as $item) {
            \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
                'id' => $item['id'],
                'submission_id' => $item['submission_id'],
                'source_snapshot_json' => json_encode(['title' => 'Synthetic shared-id reuse']),
            ])->execute();
        }
        $this->reuseNoPointer = $this->fixtures->createItem(
            'evidence-owner-no-pointer',
            $this->offering,
            'legacy_reuse'
        );
        $this->reviewOnlyItem = $this->fixtures->createItem('evidence-review-only', $this->offering);

        $this->insertRunEvidence($this->owner, true, 'old-open');
        $this->insertRunEvidence($this->attached, false, 'closed-only');
        $this->insertAttachmentEvidence($this->owner, $this->fixtures->createElectronicDestination(
            $this->offering,
            'attachment-live'
        ));
        $detachedDestination = $this->insertAttachmentEvidence($this->attached, $this->fixtures->createElectronicDestination(
            $this->offering,
            'attachment-detached'
        ));
        \Yii::$app->db->createCommand()->update('publication_attachments', [
            'live' => null,
            'detached_at' => $this->fixtureTime(100),
        ], ['destination_id' => $detachedDestination, 'item_kind' => 'new', 'item_id' => $this->attached['id']])->execute();
        $noPointer = $this->insertDestination([]);
        $this->insertAttachment($noPointer, $this->otherItem);

        $this->insertOwnerEvidence($this->owner, $this->fixtures->createElectronicDestination(
            $this->offering,
            'owner-live'
        ), ['owner_live' => 1]);
        $releasedPointer = $this->fixtures->createElectronicDestination($this->offering, 'owner-released');
        $this->insertOwnerEvidence($this->attached, $releasedPointer, ['owner_live' => null]);
        $retiredPointer = $this->fixtures->createElectronicDestination($this->offering, 'owner-retired');
        $this->insertOwnerEvidence($this->otherItem, $retiredPointer, [
            'owner_live' => 1,
            'retired_at' => $this->fixtureTime(100),
        ]);
        $this->insertOwnerEvidence($this->reuseNoPointer, [], ['owner_live' => 1]);

        $this->insertReview($this->attached, null);
        $this->insertReview($this->otherItem, $this->fixtureTime(200));
        $this->insertReview($this->reviewOnlyItem, null);
    }

    public function _after(FunctionalTester $I)
    {
        Api119A2FailingCommand::clearConfiguration();
        \Yii::$app->db->commandClass = $this->commandClass;
        parent::_after($I);
    }

    public function readsLockEvidenceForItemsInFourBatchQueries(FunctionalTester $I)
    {
        $idsByKind = [
            'new' => [
                $this->owner['id'],
                $this->attached['id'],
                $this->otherItem['id'],
                $this->emptyItem['id'],
                $this->reviewOnlyItem['id'],
            ],
            'reuse' => [
                $this->owner['id'],
                $this->attached['id'],
                $this->otherItem['id'],
                $this->reuseNoPointer['id'],
            ],
        ];
        $reader = new FacultyItemEvidenceReader();
        $reader->forItems($idsByKind);

        Api119A2FailingCommand::resetQueries();
        Assert::assertSame([], $reader->forItems([]));
        Assert::assertSame(0, $this->selectCount());

        Api119A2FailingCommand::resetQueries();
        $reader->forItems(['new' => [$this->owner['id']]]);
        $oneItemQueries = $this->selectCount();

        Api119A2FailingCommand::resetQueries();
        $actual = $reader->forItems($idsByKind);
        $allItemQueries = $this->selectCount();

        Assert::assertSame([
            'new' => [
                $this->owner['id'] => [
                    'open_run' => true,
                    'publication_history' => true,
                    'published' => true,
                    'open_review' => false,
                ],
                $this->attached['id'] => [
                    'open_run' => false,
                    'publication_history' => true,
                    'published' => false,
                    'open_review' => true,
                ],
                $this->otherItem['id'] => [
                    'open_run' => false,
                    'publication_history' => true,
                    'published' => false,
                    'open_review' => false,
                ],
                $this->emptyItem['id'] => [
                    'open_run' => false,
                    'publication_history' => false,
                    'published' => false,
                    'open_review' => false,
                ],
                $this->reviewOnlyItem['id'] => [
                    'open_run' => false,
                    'publication_history' => false,
                    'published' => false,
                    'open_review' => true,
                ],
            ],
            'reuse' => [
                $this->owner['id'] => [
                    'open_run' => false,
                    'publication_history' => true,
                    'published' => true,
                    'open_review' => false,
                ],
                $this->attached['id'] => [
                    'open_run' => false,
                    'publication_history' => true,
                    'published' => false,
                    'open_review' => false,
                ],
                $this->otherItem['id'] => [
                    'open_run' => false,
                    'publication_history' => true,
                    'published' => false,
                    'open_review' => false,
                ],
                $this->reuseNoPointer['id'] => [
                    'open_run' => false,
                    'publication_history' => true,
                    'published' => false,
                    'open_review' => false,
                ],
            ],
        ], $actual);
        Assert::assertSame($oneItemQueries, $allItemQueries);
        Assert::assertLessThanOrEqual(4, $oneItemQueries);
        Assert::assertLessThanOrEqual(4, $allItemQueries);
    }

    private function insertRunEvidence(array $item, $open, $suffix)
    {
        $runId = $this->fixtures->createFinishedRun($item, $suffix);
        if (!$open) {
            return;
        }

        $run = \Yii::$app->db->createCommand(
            'SELECT flow_id, version FROM item_flow_runs WHERE id = :id', [':id' => $runId]
        )->queryOne();
        $now = time();
        \Yii::$app->db->createCommand()->update('item_flow_runs', [
            'started_at' => date('Y-m-d H:i:s', $now - 300),
            'closed_at' => date('Y-m-d H:i:s', $now - 200),
        ], ['id' => $runId])->execute();
        \Yii::$app->db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'flow_id' => $run['flow_id'],
            'version' => $run['version'],
            'started_at' => date('Y-m-d H:i:s', $now - 600),
        ])->execute();
    }

    private function insertAttachmentEvidence(array $item, array $pointer)
    {
        $destinationId = $this->insertDestination($pointer);
        $this->insertAttachment($destinationId, $item);
        return $destinationId;
    }

    private function insertOwnerEvidence(array $item, array $pointer, array $values)
    {
        $this->insertDestination($pointer, array_merge($values, [
            'owner_item_kind' => 'reuse',
            'owner_item_id' => $item['id'],
        ]));
    }

    private function insertReview(array $item, $reviewedAt)
    {
        \Yii::$app->db->createCommand()->insert('item_history_review', [
            'item_id' => $item['id'],
            'submission_id' => $item['submission_id'],
            'trace' => bin2hex(random_bytes(16)),
            'flagged_at' => $this->fixtureTime(300),
            'reviewed_at' => $reviewedAt,
        ])->execute();
    }

    private function fixtureTime($secondsAgo)
    {
        return date('Y-m-d H:i:s', time() - $secondsAgo);
    }

    private function selectCount()
    {
        return count(array_filter(Api119A2FailingCommand::queries(), function ($sql) {
            return preg_match('/^\s*SELECT\b/i', $sql);
        }));
    }
}

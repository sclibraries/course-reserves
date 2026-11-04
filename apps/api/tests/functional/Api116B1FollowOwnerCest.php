<?php

use PHPUnit\Framework\Assert;
use app\services\Transactional;

/**
 * API-116B1 review #2: follow() validates the live owner as well as attached items, in the existing precedence
 * (offering_mismatch across all items before any physical identity check). Each destination has no attachments.
 */
class Api116B1FollowOwnerCest extends Api116ADestinationRegistryTestBase
{
    public function testFollowRejectsALiveOwnerWhoseSubmissionMovedToAnotherOffering(FunctionalTester $I)
    {
        $sourceId = $this->ownedSource('owner-offering');
        $this->moveOwner($this->otherOffering);
        $replacement = $this->fixtures->createElectronicDestination($this->offering, 'owner-offering-replacement');
        $this->assertFollowRejected($sourceId, $replacement, 'offering_mismatch');
    }

    public function testFollowRejectsALiveOwnerWhoseIdentityDiffersFromTheVerifiedReplacement(FunctionalTester $I)
    {
        $sourceId = $this->ownedSource('owner-identity');
        $this->setIdentity($this->owner, '00000000-0000-4000-8000-000000011601');
        $replacement = $this->fixtures->createPhysicalDestination(
            $this->offering, 'owner-identity-replacement', '00000000-0000-4000-8000-000000011602'
        );
        $this->assertFollowRejected($sourceId, $replacement, 'destination_unresolved');
    }

    public function testFollowRejectsALiveOwnerWithoutIdentityEvidenceForAPhysicalReplacement(FunctionalTester $I)
    {
        $sourceId = $this->ownedSource('owner-unresolved');
        $replacement = $this->fixtures->createPhysicalDestination(
            $this->offering, 'owner-unresolved-replacement', '00000000-0000-4000-8000-000000011603'
        );
        $this->assertFollowRejected($sourceId, $replacement, 'destination_unresolved');
    }

    public function testFollowOwnerOfferingMismatchPrecedesTheOwnersPhysicalIdentityFailure(FunctionalTester $I)
    {
        $sourceId = $this->ownedSource('owner-precedence');
        $this->setIdentity($this->owner, '00000000-0000-4000-8000-000000011604');
        $this->moveOwner($this->otherOffering);
        $replacement = $this->fixtures->createPhysicalDestination(
            $this->offering, 'owner-precedence-replacement', '00000000-0000-4000-8000-000000011605'
        );
        $this->assertFollowRejected($sourceId, $replacement, 'offering_mismatch');
    }

    private function ownedSource($suffix)
    {
        return $this->insertDestination($this->fixtures->createElectronicDestination($this->offering, $suffix . '-source'), [
            'owner_item_kind' => $this->owner['kind'],
            'owner_item_id' => $this->owner['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
    }

    private function moveOwner($offeringId)
    {
        \Yii::$app->db->createCommand()->update('faculty_submissions', ['offering_id' => $offeringId], [
            'submission_id' => $this->owner['submission_id'],
        ])->execute();
    }

    private function assertFollowRejected($sourceId, array $replacement, $errorCode)
    {
        $before = $this->destinationRow($sourceId);
        $this->assertError(Transactional::run(function () use ($sourceId, $replacement) {
            return $this->registry()->follow($sourceId, $replacement);
        }), $errorCode);
        Assert::assertSame($before, $this->destinationRow($sourceId));
        Assert::assertSame([], $this->attachmentRows($this->owner));
    }
}

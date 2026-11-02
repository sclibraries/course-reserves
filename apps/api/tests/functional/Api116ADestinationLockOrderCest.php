<?php

use PHPUnit\Framework\Assert;
use app\services\PublicationDestinationLock;

class Api116ADestinationLockOrderCest extends Api116ADestinationRegistryTestBase
{
    public function testLockHelperRequestsEveryLockInAscendingContractOrder(FunctionalTester $I)
    {
        $sequence = [];
        $helper = new PublicationDestinationLock(function ($table, array $ids) use (&$sequence) {
            $sequence[] = ['table' => $table, 'ids' => $ids];
            return [];
        });
        $helper->lock([
            'offering_ids' => [9, 2],
            'resource_ids' => [8, 3],
            'course_resource_ids' => [12, 11],
            'physical_reference_ids' => [14, 13],
            'destination_ids' => [22, 21],
            'submission_ids' => [4, 1],
            'new_item_ids' => [7, 3],
            'reuse_item_ids' => [8, 2],
            'publication_state_items' => [['kind' => 'reuse', 'id' => 8], ['kind' => 'new', 'id' => 3]],
            'attachment_ids' => [19, 16],
        ]);

        Assert::assertSame([
            ['table' => 'course_offerings', 'ids' => [2, 9]],
            ['table' => 'resources', 'ids' => [3, 8]],
            ['table' => 'course_resources', 'ids' => [11, 12]],
            ['table' => 'physical_resource_references', 'ids' => [13, 14]],
            ['table' => 'publication_destinations', 'ids' => [21, 22]],
            ['table' => 'faculty_submissions', 'ids' => [1, 4]],
            ['table' => 'submission_new_resources', 'ids' => [3, 7]],
            ['table' => 'submission_reuse_resources', 'ids' => [2, 8]],
            ['table' => 'submission_publication_state', 'ids' => [3, 8]],
            ['table' => 'publication_attachments', 'ids' => [16, 19]],
        ], $sequence, 'The helper calls SELECT FOR UPDATE in the documented order; no timing is used.');
    }
}

<?php

namespace tests\unit\components;

use app\components\FolioAvailabilityMapper;

class FolioAvailabilityMapperTest extends \Codeception\Test\Unit
{
    public function testMapsTwoHoldingArrayEntriesToPublicCopies()
    {
        $holdings = [
            [
                'id' => 'synthetic-item-1',
                'callNumber' => 'QA 100 .T47',
                'location' => 'Smith College Neilson Stacks',
                'status' => 'Available',
                'permanentLoanType' => 'Standard Loan',
                'suppressFromDiscovery' => 'false',
                'library' => ['name' => 'SC Neilson Library', 'code' => 'SCNLS'],
                'notes' => [],
            ],
            [
                'id' => 'synthetic-item-2',
                'callNumber' => 'M 200 .D42',
                'location' => 'Mount Holyoke College Main Stacks',
                'status' => 'Checked out',
                'permanentLoanType' => 'Limited',
                'suppressFromDiscovery' => 'false',
                'library' => ['name' => 'Mount Holyoke College Library', 'code' => 'MHLIB'],
                'notes' => [],
            ],
        ];

        $this->assertSame([
            [
                'library' => 'SC Neilson Library',
                'location' => 'Smith College Neilson Stacks',
                'callNumber' => 'QA 100 .T47',
                'status' => 'Available',
                'loanType' => 'Standard Loan',
            ],
            [
                'library' => 'Mount Holyoke College Library',
                'location' => 'Mount Holyoke College Main Stacks',
                'callNumber' => 'M 200 .D42',
                'status' => 'Checked out',
                'loanType' => 'Limited',
            ],
        ], FolioAvailabilityMapper::copiesFromHoldings($holdings));
    }

    public function testMapsOneHoldingObjectToExactlyOneCopy()
    {
        $holding = [
            'id' => 'synthetic-single-item',
            'callNumber' => 'PN 100 .S53',
            'location' => 'Smith College Neilson Stacks',
            'status' => 'Available',
            'permanentLoanType' => 'Non-circulating',
            'suppressFromDiscovery' => 'false',
            'library' => ['name' => 'SC Neilson Library', 'code' => 'SCNLS'],
            'notes' => [],
        ];

        $this->assertSame([
            [
                'library' => 'SC Neilson Library',
                'location' => 'Smith College Neilson Stacks',
                'callNumber' => 'PN 100 .S53',
                'status' => 'Available',
                'loanType' => 'Non-circulating',
            ],
        ], FolioAvailabilityMapper::copiesFromHoldings($holding));
    }

    public function testEmptyHoldingsMapToNoCopies()
    {
        $this->assertSame([], FolioAvailabilityMapper::copiesFromHoldings([]));
    }

    public function testSkipsDiscoverySuppressedHoldings()
    {
        $visible = [
            'callNumber' => 'QA 100 .T47',
            'location' => 'Smith College Neilson Stacks',
            'status' => 'Available',
            'permanentLoanType' => 'Standard Loan',
            'suppressFromDiscovery' => 'false',
            'library' => ['name' => 'SC Neilson Library', 'code' => 'SCNLS'],
        ];
        $suppressed = [
            'callNumber' => 'QA 101 .T47',
            'location' => 'Hidden synthetic location',
            'status' => 'Available',
            'permanentLoanType' => 'Standard Loan',
            'suppressFromDiscovery' => 'true',
            'library' => ['name' => 'SC Neilson Library', 'code' => 'SCNLS'],
        ];

        $this->assertSame([
            [
                'library' => 'SC Neilson Library',
                'location' => 'Smith College Neilson Stacks',
                'callNumber' => 'QA 100 .T47',
                'status' => 'Available',
                'loanType' => 'Standard Loan',
            ],
        ], FolioAvailabilityMapper::copiesFromHoldings([$visible, $suppressed]));
    }

    public function testNotesAsArraysOrObjectsDoNotChangeMappedCopies()
    {
        $first = [
            'callNumber' => 'QA 100 .T47',
            'location' => 'Smith College Neilson Stacks',
            'status' => 'Available',
            'permanentLoanType' => 'Standard Loan',
            'library' => ['name' => 'SC Neilson Library', 'code' => 'SCNLS'],
            'notes' => [['note' => 'synthetic staff note']],
        ];
        $second = [
            'callNumber' => 'M 200 .D42',
            'location' => 'Mount Holyoke College Main Stacks',
            'status' => 'Checked out',
            'permanentLoanType' => 'Limited',
            'library' => ['name' => 'Mount Holyoke College Library', 'code' => 'MHLIB'],
            'notes' => (object)['note' => 'synthetic staff note'],
        ];

        $this->assertSame([
            [
                'library' => 'SC Neilson Library',
                'location' => 'Smith College Neilson Stacks',
                'callNumber' => 'QA 100 .T47',
                'status' => 'Available',
                'loanType' => 'Standard Loan',
            ],
            [
                'library' => 'Mount Holyoke College Library',
                'location' => 'Mount Holyoke College Main Stacks',
                'callNumber' => 'M 200 .D42',
                'status' => 'Checked out',
                'loanType' => 'Limited',
            ],
        ], FolioAvailabilityMapper::copiesFromHoldings([$first, $second]));
    }
}

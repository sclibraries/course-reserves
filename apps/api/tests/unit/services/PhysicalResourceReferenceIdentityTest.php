<?php

namespace tests\unit\services;

use app\services\PhysicalResourceReferenceIdentity;
use app\services\ItemReadiness;

class PhysicalResourceReferenceIdentityTest extends \Codeception\Test\Unit
{
    private $validAccession = 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.'
        . '00000000.0000.4000.8000.000000000886';

    public function testParserEvidenceProducesCanonicalIdsInBothReferenceColumns()
    {
        $result = $this->resolve('new', [
            'id' => 81,
            'resource_data' => json_encode(['eds' => ['an' => $this->validAccession]]),
            'source_barcode' => 'SYNTHETIC-BARCODE-81',
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000886',
        ]);

        $this->assertSame('verified', $result['identity_status']);
        $this->assertSame('00000000-0000-4000-8000-000000000886', $result['folio_instance_id']);
        $this->assertSame('00000000-0000-4000-8000-000000000886', $result['external_resource_id']);
        $this->assertSame('SYNTHETIC-BARCODE-81', $result['legacy_identifier']);
        $this->assertSame('barcode', $result['legacy_identifier_type']);
    }

    public function testBareSourceInstanceIdAndUuidShapeAreNotIdentityEvidence()
    {
        $result = $this->resolve('new', [
            'id' => 82,
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000887',
        ]);

        $this->assertSame('unverified', $result['identity_status']);
        $this->assertNull($result['folio_instance_id']);
        $this->assertSame('00000000-0000-4000-8000-000000000887', $result['legacy_identifier']);
        $this->assertContains('physical_identity_required', $result['blockers']);
    }

    public function testBarcodeHoldingsItemAndLocalIdsAreNeverCanonicalInstanceIds()
    {
        $wrongKindValues = [
            ['source_barcode' => '00000000-0000-4000-8000-000000000888'],
            ['source_folio_holdings_id' => '00000000-0000-4000-8000-000000000889'],
            ['source_resource_id' => '00000000-0000-4000-8000-000000000890'],
            ['source_folio_item_id' => '00000000-0000-4000-8000-000000000891'],
        ];

        foreach ($wrongKindValues as $evidence) {
            $result = $this->resolve('new', array_merge(['id' => 83], $evidence));
            $this->assertSame('unverified', $result['identity_status']);
            $this->assertNull($result['folio_instance_id']);
        }
    }

    public function testConflictingParserAndExistingItemEvidenceRemainsUnverified()
    {
        $result = $this->resolve('new', [
            'id' => 84,
            'resource_data' => json_encode(['eds' => ['an' => $this->validAccession]]),
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000892',
        ]);

        $this->assertSame('unverified', $result['identity_status']);
        $this->assertNull($result['folio_instance_id']);
        $this->assertSame('conflicting_evidence', $result['provenance']['reason']);
    }

    public function testNewTableReuseAndLegacyReuseKeepKindSeparateWhenItemIdsMatch()
    {
        $new = $this->resolve('new', [
            'id' => 91,
            'resource_data' => json_encode(['eds' => ['an' => $this->validAccession]]),
        ]);
        $newReuse = $this->resolve('new', [
            'id' => 91,
            'is_reuse' => 1,
            'resource_data' => json_encode(['eds' => ['an' => $this->accessionFor('000000000892')]]),
        ]);
        $legacyReuse = $this->resolve('reuse', [
            'id' => 91,
            'source_snapshot_json' => json_encode(['eds' => ['an' => $this->accessionFor('000000000893')]]),
        ]);

        $this->assertSame('new', $new['provenance']['item_kind']);
        $this->assertSame('new', $newReuse['provenance']['item_kind']);
        $this->assertSame('reuse', $legacyReuse['provenance']['item_kind']);
        $this->assertNotSame($new['folio_instance_id'], $newReuse['folio_instance_id']);
        $this->assertNotSame($newReuse['folio_instance_id'], $legacyReuse['folio_instance_id']);
    }

    public function testEstablishedIdentityMustMatchThisItemAndRepeatedEvidenceIsStable()
    {
        $result = $this->resolve('reuse', [
            'id' => 92,
            'established_folio_instance_id' => '00000000-0000-4000-8000-000000000894',
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000894',
        ]);

        $this->assertSame('verified', $result['identity_status']);
        $this->assertSame('established_item_identity', $result['provenance']['evidence_source']);
        $this->assertSame($result, $this->resolve('reuse', [
            'id' => 92,
            'established_folio_instance_id' => '00000000-0000-4000-8000-000000000894',
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000894',
        ]));

        $conflict = $this->resolve('reuse', [
            'id' => 92,
            'established_folio_instance_id' => '00000000-0000-4000-8000-000000000894',
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000895',
        ]);
        $this->assertSame('unverified', $conflict['identity_status']);
    }

    public function testIdentityBlockerAppliesOnlyToPrintDestinations()
    {
        $print = $this->resolve('new', ['id' => 93, 'destination_class' => 'print']);
        $ebook = $this->resolve('new', ['id' => 94, 'destination_class' => 'electronic']);

        $this->assertContains('physical_identity_required', $print['blockers']);
        $this->assertNotContains('physical_identity_required', $ebook['blockers']);
    }

    public function testProvenanceNamesTheEvidenceAndOutcomeWithoutBecomingPublicData()
    {
        $result = $this->resolve('new', [
            'id' => 95,
            'resource_data' => json_encode(['eds' => ['an' => $this->validAccession]]),
        ]);

        $this->assertSame('resource_data.eds.an', $result['provenance']['matched_field']);
        $this->assertSame($this->validAccession, $result['provenance']['matched_value']);
        $this->assertSame('verified', $result['provenance']['outcome']);
        $actualKeys = array_keys($result['provenance']);
        $expectedKeys = ['evidence_source', 'item_kind', 'item_id', 'matched_field', 'matched_value', 'outcome', 'reason'];
        sort($actualKeys);
        sort($expectedKeys);
        $this->assertSame($expectedKeys, $actualKeys);
    }

    public function testExistingOnlineAvailabilityReadinessRemainsIndependentOfPhysicalIdentity()
    {
        $item = ['resource_data' => ['url' => 'https://example.test/synthetic-resource']];
        $readiness = ItemReadiness::evaluate($item, null, ItemReadiness::catalogInstanceId($item));

        $this->assertSame('ready', $readiness['readiness']);
        $this->assertSame('Online access is available.', $readiness['readiness_reason']);
    }

    private function resolve($kind, array $item)
    {
        return (new PhysicalResourceReferenceIdentity())->resolve($kind, $item);
    }

    private function accessionFor($uuidTail)
    {
        return 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.'
            . '00000000.0000.4000.8000.' . $uuidTail;
    }
}

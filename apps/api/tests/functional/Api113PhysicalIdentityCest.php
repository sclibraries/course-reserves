<?php

use PHPUnit\Framework\Assert;

/** Covers safe physical identity, private provenance, cleanup and migration behavior. */
class Api113PhysicalIdentityCest extends Api109FunctionalCest
{
    protected $prefix = 'test-api113-';
    private $migrationVersion = 'm261030_000001_add_physical_reference_identity';
    private $offeringIds = [];
    private $courseIds = [];
    private $referenceIds = [];
    private $originalUrlManager;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->loadProductionRouter();
    }

    public function _after(FunctionalTester $I)
    {
        try {
            parent::_after($I);
            $this->cleanupApi113();
        } finally {
            if ($this->originalUrlManager !== null) {
                \Yii::$app->set('urlManager', $this->originalUrlManager);
                $this->originalUrlManager = null;
            }
        }
    }

    public function todayCreateUpdateAndReorderPayloadsKeepUnresolvedReferencesWorking(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('compatibility');
        $barcode = 'API113-SYNTHETIC-BARCODE-01';
        $this->request($I, 'POST', 'physical-resource/create-or-update-reference', [
            'external_resource_id' => $barcode,
            'resource_type' => 'physical',
            'display_name' => 'API-113 synthetic reserve',
            'offering_id' => $offeringId,
            'order' => 11,
        ]);
        $I->seeResponseCodeIs(200);
        $created = $this->response($I);
        Assert::assertSame($barcode, $created['external_resource_id']);
        $referenceId = (int)$created['reference_id'];
        Assert::assertSame('API-113 synthetic reserve', $created['display_name']);

        $duplicate = new \app\models\PhysicalResourceReferences();
        $duplicate->external_resource_id = $barcode;
        $duplicate->offering_id = $offeringId;
        Assert::assertFalse($duplicate->validate(['external_resource_id', 'offering_id']), 'Model validation must keep the legacy uniqueness rule.');
        $this->request($I, 'POST', 'physical-resource/create-or-update-reference', [
            'external_resource_id' => $barcode,
            'resource_type' => 'physical',
            'display_name' => 'API-113 synthetic reserve updated',
            'offering_id' => $offeringId,
            'order' => 9,
        ]);
        $I->seeResponseCodeIs(200);
        $updated = $this->response($I);
        Assert::assertSame($referenceId, (int)$updated['reference_id']);
        Assert::assertSame('API-113 synthetic reserve updated', $updated['display_name']);

        \Yii::$app->db->createCommand()->update('physical_resource_references', [
            'updated_at' => '2020-01-01 00:00:00',
        ], ['reference_id' => $referenceId])->execute();

        $this->request($I, 'POST', 'physical-resource/update-resource-order', [
            'offering_id' => $offeringId,
            'resources' => [[
                'external_resource_id' => $barcode,
                'display_name' => 'API-113 reordered reserve',
                'order' => 2,
            ]],
        ]);
        $I->seeResponseCodeIs(200);
        $row = \Yii::$app->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id', [':id' => $referenceId]
        )->queryOne();
        Assert::assertSame($referenceId, (int)$row['reference_id']);
        Assert::assertSame($barcode, $row['external_resource_id']);
        Assert::assertSame(2, (int)$row['order']);
        Assert::assertSame('API-113 synthetic reserve updated', $row['display_name']);
        Assert::assertNotSame('2020-01-01 00:00:00', $row['updated_at'], 'Metadata/order updates keep the existing timestamp behavior.');
    }

    public function newReferencesWithoutEvidenceRemainUnverifiedAfterReorder(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('unresolved-identity');
        $barcode = 'API113-SYNTHETIC-BARCODE-02';
        $this->request($I, 'POST', 'physical-resource/create-or-update-reference', [
            'external_resource_id' => $barcode,
            'resource_type' => 'physical',
            'display_name' => 'API-113 unresolved reserve',
            'offering_id' => $offeringId,
            'order' => 11,
        ]);
        $I->seeResponseCodeIs(200);
        $created = $this->response($I);
        Assert::assertArrayHasKey('identity_status', $created);
        Assert::assertArrayHasKey('folio_instance_id', $created);
        Assert::assertArrayHasKey('legacy_identifier', $created);
        Assert::assertSame('unverified', $created['identity_status']);
        Assert::assertSame($barcode, $created['external_resource_id']);
        Assert::assertSame($barcode, $created['legacy_identifier']);
        Assert::assertNull($created['folio_instance_id']);

        $this->request($I, 'POST', 'physical-resource/update-resource-order', [
            'offering_id' => $offeringId,
            'resources' => [[
                'external_resource_id' => $barcode,
                'display_name' => 'API-113 unresolved reserve reordered',
                'order' => 3,
            ]],
        ]);
        $I->seeResponseCodeIs(200);
        $this->assertReferenceIdentity($barcode, $offeringId, 'unverified', null);
        $row = $this->reference($barcode, $offeringId);
        Assert::assertSame('unverified', $row['identity_status']);
        Assert::assertNull($row['folio_instance_id']);
        Assert::assertSame($barcode, $row['legacy_identifier']);
        Assert::assertSame(3, (int)$row['order']);
    }

    public function forgedIdentityFieldsCannotVerifyCreateOrMetadataUpdate(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('forged-input');
        $legacyId = 'API113-SYNTHETIC-FORGED-ID';
        $forgedCanonicalId = '00000000-0000-4000-8000-000000000901';
        $this->request($I, 'POST', 'physical-resource/create-or-update-reference', [
            'external_resource_id' => $legacyId,
            'resource_type' => 'physical',
            'display_name' => 'API-113 forged identity title',
            'offering_id' => $offeringId,
            'folio_instance_id' => $forgedCanonicalId,
            'identity_status' => 'verified',
            'legacy_identifier' => 'caller-set-legacy-value',
            'legacy_identifier_type' => 'instance',
            'identity_provenance_json' => '{"outcome":"verified"}',
        ]);
        $I->seeResponseCodeIs(200);
        $created = $this->reference($legacyId, $offeringId);
        Assert::assertArrayHasKey('identity_status', $created);
        Assert::assertArrayHasKey('folio_instance_id', $created);
        Assert::assertArrayHasKey('legacy_identifier', $created);
        Assert::assertSame('unverified', $created['identity_status']);
        Assert::assertNull($created['folio_instance_id']);
        Assert::assertSame($legacyId, $created['legacy_identifier']);
        Assert::assertNotSame('caller-set-legacy-value', $created['legacy_identifier']);

        $this->request($I, 'POST', 'physical-resource/create-or-update-reference', [
            'external_resource_id' => $legacyId,
            'resource_type' => 'physical',
            'display_name' => 'API-113 ordinary metadata correction',
            'offering_id' => $offeringId,
            'folio_instance_id' => $forgedCanonicalId,
            'identity_status' => 'verified',
            'identity_provenance_json' => '{"outcome":"verified"}',
        ]);
        $I->seeResponseCodeIs(200);
        $updated = $this->reference($legacyId, $offeringId);
        Assert::assertSame('API-113 ordinary metadata correction', $updated['display_name']);
        Assert::assertSame('unverified', $updated['identity_status']);
        Assert::assertNull($updated['folio_instance_id']);

        $uuidShapedKey = '00000000-0000-4000-8000-000000000907';
        $this->request($I, 'POST', 'physical-resource/create-or-update-reference', [
            'external_resource_id' => $uuidShapedKey,
            'resource_type' => 'physical',
            'display_name' => 'API-113 UUID-shaped legacy identifier',
            'offering_id' => $offeringId,
        ]);
        $I->seeResponseCodeIs(200);
        $uuidShaped = $this->reference($uuidShapedKey, $offeringId);
        Assert::assertSame('unverified', $uuidShaped['identity_status']);
        Assert::assertNull($uuidShaped['folio_instance_id']);
    }

    public function legacyExternalIdLookupRemainsReadOnlyAndOfferingScoped(FunctionalTester $I)
    {
        $firstOffering = $this->createOffering('lookup-one');
        $secondOffering = $this->createOffering('lookup-two');
        $legacyId = 'API113-SYNTHETIC-SHARED-BARCODE';
        $firstId = $this->insertReference($legacyId, $firstOffering, 'API-113 first offering copy');
        $secondId = $this->insertReference($legacyId, $secondOffering, 'API-113 second offering copy');
        $before = $this->reference($legacyId, $firstOffering);
        $beforeCount = (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references'
        )->queryScalar();

        $this->request($I, 'GET', 'physical-resource/by-external-id/' . rawurlencode($legacyId), [], [
            'offering_id' => $firstOffering,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($firstId, (int)$this->response($I)['reference_id']);
        Assert::assertSame($before['updated_at'], $this->reference($legacyId, $firstOffering)['updated_at']);

        $this->request($I, 'GET', 'physical-resource/by-external-id/' . rawurlencode($legacyId), [], [
            'offering_id' => $secondOffering,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($secondId, (int)$this->response($I)['reference_id']);

        Assert::assertSame($before['updated_at'], $this->reference($legacyId, $firstOffering)['updated_at']);
        Assert::assertSame($beforeCount, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references'
        )->queryScalar());
    }

    public function canonicalFallbackLookupIsOfferingScopedAndNeverAmbiguous(FunctionalTester $I)
    {
        $firstOffering = $this->createOffering('canonical-lookup-one');
        $secondOffering = $this->createOffering('canonical-lookup-two');
        $canonicalId = '00000000-0000-4000-8000-000000000920';
        $firstLegacyId = 'API113-SYNTHETIC-ALT-BARCODE-ONE';
        $secondLegacyId = 'API113-SYNTHETIC-ALT-BARCODE-TWO';
        $firstId = $this->insertReference($firstLegacyId, $firstOffering, 'API-113 first canonical copy');
        $secondId = $this->insertReference($secondLegacyId, $secondOffering, 'API-113 second canonical copy');
        $this->setIdentity($firstId, 'verified', $canonicalId, $firstLegacyId);
        $this->setIdentity($secondId, 'verified', $canonicalId, $secondLegacyId);
        $beforeCount = (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references'
        )->queryScalar();

        $this->request($I, 'GET', 'physical-resource/by-external-id/' . rawurlencode($canonicalId), [], [
            'offering_id' => $firstOffering,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($firstId, (int)$this->response($I)['reference_id']);

        $this->request($I, 'GET', 'physical-resource/by-external-id/' . rawurlencode($canonicalId), [], [
            'offering_id' => $secondOffering,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($secondId, (int)$this->response($I)['reference_id']);

        $this->request($I, 'GET', 'physical-resource/by-external-id/' . rawurlencode($canonicalId));
        Assert::assertNotSame(200, \Yii::$app->response->statusCode, 'Canonical fallback must not select across offerings.');
        Assert::assertSame($beforeCount, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references'
        )->queryScalar());
    }

    public function anonymousReferenceListKeepsProvenanceAndLegacyFieldsPrivate(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('anonymous-output');
        $verifiedId = $this->insertReference('00000000-0000-4000-8000-000000000902', $offeringId, 'API-113 verified row');
        $unverifiedId = $this->insertReference('API113-SYNTHETIC-BARCODE-02', $offeringId, 'API-113 old barcode row');
        $this->setIdentity($verifiedId, 'verified', '00000000-0000-4000-8000-000000000902', 'API113-SYNTHETIC-BARCODE-02');
        $this->setIdentity($unverifiedId, 'unverified', null, 'API113-SYNTHETIC-BARCODE-02');

        $I->deleteHeader('Authorization');
        $I->sendJsonRequest('GET', 'physical-resource/get-references?offering_id=' . $offeringId, []);
        $I->seeResponseCodeIs(200);
        $rows = $this->response($I);
        $byId = [];
        foreach ($rows as $row) {
            $byId[(int)$row['reference_id']] = $row;
        }
        Assert::assertSame('00000000-0000-4000-8000-000000000902', $byId[$verifiedId]['folio_instance_id']);
        Assert::assertSame('API113-SYNTHETIC-BARCODE-02', $byId[$unverifiedId]['external_resource_id']);
        foreach ($rows as $row) {
            $allowedFields = [
                'reference_id', 'external_resource_id', 'resource_type', 'display_name', 'offering_id',
                'folder_id', 'order', 'created_at', 'updated_at', 'folio_instance_id',
            ];
            foreach (array_keys($row) as $field) {
                Assert::assertContains($field, $allowedFields, 'Public response field must be allowlisted: ' . $field);
            }
            foreach ([
                'legacy_identifier', 'legacy_identifier_type', 'identity_status',
                'identity_provenance_json', 'provenance', 'evidence_source', 'matched_field', 'matched_value',
            ] as $privateField) {
                Assert::assertArrayNotHasKey($privateField, $row, 'Anonymous physical references must omit ' . $privateField . '.');
            }
        }
    }

    public function cleanupRetainsUnverifiedPublishedMaterializedAndOtherOfferingRows(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('cleanup-primary');
        $otherOfferingId = $this->createOffering('cleanup-other');
        $eligible = $this->insertReference('API113-CLEANUP-ELIGIBLE', $offeringId, 'API-113 eligible');
        $unverified = $this->insertReference('API113-CLEANUP-UNVERIFIED', $offeringId, 'API-113 unverified');
        $published = $this->insertReference('00000000-0000-4000-8000-000000000903', $offeringId, 'API-113 published');
        $newMarker = $this->insertReference('00000000-0000-4000-8000-000000000904', $offeringId, 'API-113 new marker');
        $reuseMarker = $this->insertReference('00000000-0000-4000-8000-000000000905', $offeringId, 'API-113 reuse marker');
        $otherCourse = $this->insertReference('00000000-0000-4000-8000-000000000906', $otherOfferingId, 'API-113 other offering');
        $this->setIdentity($eligible, 'verified', 'API113-CLEANUP-ELIGIBLE', null);
        $this->setIdentity($unverified, 'unverified', null, 'API113-CLEANUP-UNVERIFIED');
        $this->setIdentity($published, 'verified', '00000000-0000-4000-8000-000000000903', null);
        $this->setIdentity($newMarker, 'verified', '00000000-0000-4000-8000-000000000904', null);
        $this->setIdentity($reuseMarker, 'verified', '00000000-0000-4000-8000-000000000905', null);
        $this->setIdentity($otherCourse, 'verified', '00000000-0000-4000-8000-000000000906', null);

        $publishedItem = $this->createItemForOffering('published-marker', $offeringId, 'new');
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new',
            'item_id' => $publishedItem['id'],
            'submission_id' => $publishedItem['submission_id'],
            'state' => 'published',
            'published_destination_json' => json_encode(['kind' => 'physical', 'reference_id' => $published]),
            'reconciliation_status' => 'verified',
        ])->execute();
        $newItem = $this->createItemForOffering('new-marker', $offeringId, 'new');
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'materialized_physical_reference_id' => $newMarker,
        ], ['id' => $newItem['id']])->execute();
        $reuseItem = $this->createItemForOffering('reuse-marker', $offeringId, 'reuse');
        \Yii::$app->db->createCommand()->update('submission_reuse_resources', [
            'materialized_physical_reference_id' => $reuseMarker,
        ], ['id' => $reuseItem['id']])->execute();

        $this->request($I, 'POST', 'physical-resource/cleanup-references', [
            'offering_id' => $offeringId,
            'folio_resource_ids' => [],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->referenceCount($eligible), 'An empty cleanup list must be a no-op.');

        $this->request($I, 'POST', 'physical-resource/cleanup-references', [
            'offering_id' => $offeringId,
            'folio_resource_ids' => ['API113-RESOURCE-STILL-PRESENT'],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(0, $this->referenceCount($eligible));
        foreach ([$unverified, $published, $newMarker, $reuseMarker, $otherCourse] as $retainedId) {
            Assert::assertSame(1, $this->referenceCount($retainedId), 'Protected reference ' . $retainedId . ' must remain.');
        }
    }

    public function cleanupRejectsInvalidListsAndDoesNotCrossOfferingBoundaries(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('cleanup-validation');
        $otherOfferingId = $this->createOffering('cleanup-validation-other');
        $localId = $this->insertReference('API113-VALIDATION-LOCAL', $offeringId, 'API-113 local');
        $otherId = $this->insertReference('API113-VALIDATION-OTHER', $otherOfferingId, 'API-113 other');
        $this->setIdentity($localId, 'verified', 'API113-VALIDATION-LOCAL', null);
        $this->setIdentity($otherId, 'verified', 'API113-VALIDATION-OTHER', null);

        $this->request($I, 'POST', 'physical-resource/cleanup-references', [
            'offering_id' => $offeringId,
            'folio_resource_ids' => 'not-an-array',
        ]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame(1, $this->referenceCount($localId));
        Assert::assertSame(1, $this->referenceCount($otherId));

        $this->request($I, 'POST', 'physical-resource/cleanup-references', [
            'offering_id' => 2147483000,
            'folio_resource_ids' => ['API113-VALIDATION-LOCAL'],
        ]);
        Assert::assertSame(1, $this->referenceCount($localId));
        Assert::assertSame(1, $this->referenceCount($otherId));

        $this->request($I, 'POST', 'physical-resource/cleanup-references', [
            'offering_id' => $offeringId,
            'folio_resource_ids' => [$otherId],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(0, $this->referenceCount($localId));
        Assert::assertSame(1, $this->referenceCount($otherId));
    }

    public function submissionPublicationRemainsDisabledForPhysicalIdentityWork(FunctionalTester $I)
    {
        $offeringId = $this->createOffering('publication-disabled');
        $item = $this->createItemForOffering('publication-disabled', $offeringId, 'new');
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId('book'),
            'source_barcode' => 'API113-PUBLICATION-BARCODE',
            'resource_data' => json_encode(['title' => 'API-113 synthetic print title']),
        ], ['id' => $item['id']])->execute();

        $this->request($I, 'POST', 'submission-workflow/complete-processing', [], [
            'itemId' => $item['id'],
        ]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('publication_not_available_yet', $this->response($I)['error_code']);
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references WHERE offering_id = :offering AND external_resource_id = :id',
            [':offering' => $offeringId, ':id' => 'API113-PUBLICATION-BARCODE']
        )->queryScalar());
        $this->assertNoDestination('new', $item['id']);
    }

    public function migrationUsesMaterializedMarkersKindAndOfferingWithProvenEvidence(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () use ($I) {
            $db = \Yii::$app->db;
            $offering = $this->createOffering('migration-primary');
            $otherOffering = $this->createOffering('migration-other');
            $knownNew = '00000000-0000-4000-8000-000000000911';
            $knownReuse = '00000000-0000-4000-8000-000000000912';
            $conflicting = '00000000-0000-4000-8000-000000000913';
            $validNew = $this->createItemForOffering('migration-new-valid', $offering, 'new');
            $validReuse = $this->createItemForOffering('migration-reuse-valid', $offering, 'reuse');
            $conflictItem = $this->createItemForOffering('migration-conflict', $offering, 'new');
            $duplicateOne = $this->createItemForOffering('migration-duplicate-one', $offering, 'new');
            $duplicateTwo = $this->createItemForOffering('migration-duplicate-two', $offering, 'new');
            $wrongOfferingItem = $this->createItemForOffering('migration-wrong-offering', $offering, 'new');
            $directItem = $this->createItemForOffering('migration-direct-only', $offering, 'new');
            $verifiedStatusOnly = $this->createItemForOffering('migration-status-only', $offering, 'new');
            $missingMarker = $this->createItemForOffering('migration-missing-marker', $offering, 'new');

            $newRef = $this->insertReference($knownNew, $offering, 'API-113 migration new verified');
            $reuseRef = $this->insertReference($knownReuse, $offering, 'API-113 migration reuse verified');
            $barcodeRef = $this->insertReference('API113-MIGRATION-OLD-BARCODE', $offering, 'API-113 migration barcode');
            $conflictRef = $this->insertReference($conflicting, $offering, 'API-113 migration conflict');
            $duplicateRef = $this->insertReference('00000000-0000-4000-8000-000000000914', $offering, 'API-113 duplicate claimant');
            $wrongOfferingRef = $this->insertReference('00000000-0000-4000-8000-000000000915', $otherOffering, 'API-113 wrong offering');
            $directRef = $this->insertReference('00000000-0000-4000-8000-000000000916', $offering, 'API-113 direct reference');
            $statusRef = $this->insertReference('00000000-0000-4000-8000-000000000917', $offering, 'API-113 publication status only');
            $missingRef = $this->insertReference('00000000-0000-4000-8000-000000000918', $offering, 'API-113 missing item');

            $this->setMigrationEvidence('new', $validNew['id'], $this->accessionFor($knownNew), $knownNew);
            $this->setMigrationEvidence('reuse', $validReuse['id'], $this->accessionFor($knownReuse), $knownReuse);
            $this->setMigrationEvidence('new', $conflictItem['id'], $this->accessionFor($conflicting), '00000000-0000-4000-8000-000000000999');
            $this->setMigrationEvidence('new', $duplicateOne['id'], $this->accessionFor('000000000914'), '00000000-0000-4000-8000-000000000914');
            $this->setMigrationEvidence('new', $duplicateTwo['id'], $this->accessionFor('000000000914'), '00000000-0000-4000-8000-000000000914');
            $this->setMigrationEvidence('new', $wrongOfferingItem['id'], $this->accessionFor('000000000915'), '00000000-0000-4000-8000-000000000915');
            $this->setMigrationEvidence('new', $directItem['id'], $this->accessionFor('000000000916'), '00000000-0000-4000-8000-000000000916');
            $this->setMigrationEvidence('new', $verifiedStatusOnly['id'], $this->accessionFor('000000000917'), '00000000-0000-4000-8000-000000000917');
            $this->setMigrationEvidence('new', $missingMarker['id'], $this->accessionFor('000000000918'), '00000000-0000-4000-8000-000000000918');

            $this->setMarker('new', $validNew['id'], $newRef);
            $this->setMarker('reuse', $validReuse['id'], $reuseRef);
            $this->setMarker('new', $conflictItem['id'], $conflictRef);
            $this->setMarker('new', $duplicateOne['id'], $duplicateRef);
            $this->setMarker('new', $duplicateTwo['id'], $duplicateRef);
            $this->setMarker('new', $wrongOfferingItem['id'], $wrongOfferingRef);
            $this->setMarker('new', $missingMarker['id'], 2147483000);
            $db->createCommand()->insert('submission_publication_state', [
                'item_kind' => 'new',
                'item_id' => $verifiedStatusOnly['id'],
                'submission_id' => $verifiedStatusOnly['submission_id'],
                'state' => 'published',
                'reconciliation_status' => 'verified',
            ])->execute();

            $timestamps = [];
            foreach ([$newRef, $reuseRef, $barcodeRef, $conflictRef, $duplicateRef, $wrongOfferingRef, $directRef, $statusRef, $missingRef] as $referenceId) {
                $timestamps[$referenceId] = $this->referenceById($referenceId);
            }
            $publicationBefore = $db->createCommand(
                'SELECT * FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
                [':id' => $verifiedStatusOnly['id']]
            )->queryOne();
            $beforeNewOutput = $this->getOfferingReferences($I, $offering);

            MigrationRollback::migrate('up');
            $db->schema->refresh();

            $this->assertIdentityColumnsExist();
            $this->assertMigratedIdentity($newRef, 'verified', $knownNew);
            $this->assertMigratedIdentity($reuseRef, 'verified', $knownReuse);
            Assert::assertSame($knownNew, $this->referenceById($newRef)['external_resource_id']);
            Assert::assertSame($knownReuse, $this->referenceById($reuseRef)['external_resource_id']);
            $this->assertMigratedIdentity($barcodeRef, 'unverified', null);
            foreach ([$conflictRef, $duplicateRef, $wrongOfferingRef, $directRef, $statusRef, $missingRef] as $referenceId) {
                $this->assertMigratedIdentity($referenceId, 'unverified', null);
            }
            $this->assertMigrationProvenance($newRef, 'new', $validNew['id'], 'resource_data.eds.an', $this->accessionFor($knownNew));
            $this->assertMigrationProvenance($reuseRef, 'reuse', $validReuse['id'], 'source_snapshot_json.eds.an', $this->accessionFor($knownReuse));

            foreach ($timestamps as $referenceId => $before) {
                $after = $this->referenceById($referenceId);
                Assert::assertSame($before['updated_at'], $after['updated_at'], 'Backfill must preserve updated_at.');
                foreach (['reference_id', 'external_resource_id', 'resource_type', 'display_name', 'offering_id', 'order', 'created_at'] as $field) {
                    Assert::assertSame($before[$field], $after[$field], 'Backfill must preserve ' . $field . '.');
                }
            }
            $publicationAfter = $db->createCommand(
                'SELECT * FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
                [':id' => $verifiedStatusOnly['id']]
            )->queryOne();
            Assert::assertSame($publicationBefore, $publicationAfter, 'Identity backfill must leave API-105 publication state untouched.');
            $afterNewOutput = $this->getOfferingReferences($I, $offering);
            $this->assertExistingPublicRowsPreserved($beforeNewOutput, $afterNewOutput, [$newRef, $reuseRef]);
        });
    }

    public function migrationIsAdditiveIdempotentAndRecoversAfterPartialUp(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offeringId = $this->createOffering('migration-idempotence');
            $referenceId = $this->insertReference('API113-MIGRATION-UNCHANGED-KEY', $offeringId, 'API-113 preserved row');
            $this->setMigrationEvidence('new', $this->createItemForOffering('migration-timestamp', $offeringId, 'new')['id'], null, null);
            $before = $this->referenceById($referenceId);

            $db->createCommand()->addColumn('physical_resource_references', 'folio_instance_id', 'varchar(255) NULL')->execute();
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertIdentityColumnsExist();

            $migration = new m261030_000001_add_physical_reference_identity();
            $verifiedBeforeRerun = $this->referenceById($referenceId);
            $migration->safeUp();
            $db->schema->refresh();
            $this->assertIdentityColumnsExist();
            Assert::assertSame($before['external_resource_id'], $this->referenceById($referenceId)['external_resource_id']);
            Assert::assertSame($before['updated_at'], $this->referenceById($referenceId)['updated_at']);
            Assert::assertSame($verifiedBeforeRerun, $this->referenceById($referenceId), 'Rerunning up must preserve established identity evidence.');

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            $columns = $db->schema->getTableSchema('physical_resource_references', true)->columns;
            Assert::assertArrayNotHasKey('folio_instance_id', $columns);
            Assert::assertArrayNotHasKey('legacy_identifier', $columns);
            Assert::assertArrayNotHasKey('legacy_identifier_type', $columns);
            Assert::assertArrayNotHasKey('identity_status', $columns);
            Assert::assertArrayNotHasKey('identity_provenance_json', $columns);
            Assert::assertArrayHasKey('external_resource_id', $columns);
            Assert::assertArrayHasKey('offering_id', $columns);
            Assert::assertSame($before['external_resource_id'], $this->referenceById($referenceId)['external_resource_id']);
            Assert::assertSame($before['updated_at'], $this->referenceById($referenceId)['updated_at']);

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertIdentityColumnsExist();
        });
    }

    public function metadataEditsAfterMigrationSurviveDownWithoutRewritingExistingKeys(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offeringId = $this->createOffering('migration-down-edit');
            $legacyId = 'API113-MIGRATION-DOWN-BARCODE';
            $referenceId = $this->insertReference($legacyId, $offeringId, 'API-113 original title');
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->setIdentity($referenceId, 'unverified', null, $legacyId);
            $db->createCommand()->update('physical_resource_references', [
                'display_name' => 'API-113 title edited after migration',
                'order' => 6,
            ], ['reference_id' => $referenceId])->execute();

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            $row = $this->referenceById($referenceId);
            Assert::assertSame($legacyId, $row['external_resource_id']);
            Assert::assertSame('API-113 title edited after migration', $row['display_name']);
            Assert::assertSame(6, (int)$row['order']);
        });
    }

    private function createOffering($suffix)
    {
        $db = \Yii::$app->db;
        $uuid = $this->uuid();
        $db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $uuid,
            'course_name' => 'API-113 synthetic course ' . $suffix,
            'course_number' => 'TST-113-' . substr(str_replace('-', '', $uuid), 0, 8),
        ])->execute();
        $courseId = (int)$db->getLastInsertID();
        $this->courseIds[] = $courseId;
        $db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'folio_course_id' => 'api113-listing-' . bin2hex(random_bytes(3)),
            'term_id' => 'api113-term-' . bin2hex(random_bytes(3)),
            'term_name' => 'API-113 synthetic term',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$db->getLastInsertID();
        $this->offeringIds[] = $offeringId;
        return $offeringId;
    }

    private function loadProductionRouter()
    {
        $this->originalUrlManager = \Yii::$app->get('urlManager');
        $webConfig = require codecept_root_dir('config/web.php');
        $urlManagerConfig = $webConfig['components']['urlManager'];
        $urlManagerConfig['class'] = \yii\web\UrlManager::class;
        \Yii::$app->set('urlManager', $urlManagerConfig);
        \Yii::$app->urlManager->showScriptName = false;
    }

    private function createItemForOffering($suffix, $offeringId, $kind)
    {
        $submissionId = $this->createSubmission($suffix);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'offering_id' => $offeringId,
            'folio_course_listing_id' => 'api113-listing-' . $offeringId,
        ], ['submission_id' => $submissionId])->execute();
        if ($kind === 'new') {
            $itemId = (int)\Yii::$app->db->createCommand(
                'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1', [':id' => $submissionId]
            )->queryScalar();
        } else {
            \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
                'submission_id' => $submissionId,
                'faculty_notes' => 'API-113 synthetic reuse note',
            ])->execute();
            $itemId = (int)\Yii::$app->db->getLastInsertID();
        }
        return ['submission_id' => $submissionId, 'id' => $itemId, 'kind' => $kind];
    }

    private function insertReference($externalId, $offeringId, $displayName)
    {
        \Yii::$app->db->createCommand()->insert('physical_resource_references', [
            'external_resource_id' => $externalId,
            'resource_type' => 'physical',
            'display_name' => $displayName,
            'offering_id' => $offeringId,
            'order' => 4,
            'created_at' => '2026-10-01 10:00:00',
            'updated_at' => '2026-10-01 10:00:00',
        ])->execute();
        $referenceId = (int)\Yii::$app->db->getLastInsertID();
        $this->referenceIds[] = $referenceId;
        return $referenceId;
    }

    private function setIdentity($referenceId, $status, $instanceId, $legacyId)
    {
        \Yii::$app->db->createCommand()->update('physical_resource_references', [
            'identity_status' => $status,
            'folio_instance_id' => $instanceId,
            'legacy_identifier' => $legacyId,
            'legacy_identifier_type' => $legacyId === null ? 'unknown' : 'barcode',
            'identity_provenance_json' => json_encode([
                'evidence_source' => 'synthetic-test-fixture',
                'item_kind' => 'new',
                'item_id' => 1,
                'matched_field' => 'resource_data.eds.an',
                'matched_value' => $instanceId,
                'outcome' => $status,
                'reason' => null,
            ]),
        ], ['reference_id' => $referenceId])->execute();
    }

    private function setMigrationEvidence($kind, $itemId, $accession, $sourceInstanceId)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $data = [
            'source_folio_instance_id' => $sourceInstanceId,
            'source_snapshot_json' => $accession === null ? null : json_encode(['eds' => ['an' => $accession]]),
        ];
        if ($kind === 'new') {
            $data['resource_data'] = json_encode(['title' => 'API-113 synthetic migration item', 'eds' => ['an' => $accession]]);
        }
        \Yii::$app->db->createCommand()->update($table, $data, ['id' => $itemId])->execute();
    }

    private function setMarker($kind, $itemId, $referenceId)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        \Yii::$app->db->createCommand()->update($table, [
            'materialized_physical_reference_id' => $referenceId,
            'materialized_at' => '2026-10-02 10:00:00',
        ], ['id' => $itemId])->execute();
    }

    private function assertMigrationProvenance($referenceId, $kind, $itemId, $field, $value)
    {
        $json = (string)\Yii::$app->db->createCommand(
            'SELECT identity_provenance_json FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $referenceId]
        )->queryScalar();
        $provenance = json_decode($json, true);
        Assert::assertSame($kind, $provenance['item_kind']);
        Assert::assertSame($itemId, (int)$provenance['item_id']);
        Assert::assertSame($field, $provenance['matched_field']);
        Assert::assertSame($value, $provenance['matched_value']);
        Assert::assertSame('verified', $provenance['outcome']);
        Assert::assertArrayHasKey('evidence_source', $provenance);
        Assert::assertArrayHasKey('reason', $provenance);
    }

    private function assertMigratedIdentity($referenceId, $status, $instanceId)
    {
        $row = $this->referenceById($referenceId);
        Assert::assertSame($status, $row['identity_status']);
        Assert::assertSame($instanceId, $row['folio_instance_id']);
        Assert::assertSame($row['external_resource_id'], $this->referenceById($referenceId)['external_resource_id']);
    }

    private function assertExistingPublicRowsPreserved(array $before, array $after, array $verifiedIds)
    {
        $byIdBefore = [];
        $byIdAfter = [];
        foreach ($before as $row) {
            $byIdBefore[(int)$row['reference_id']] = $row;
        }
        foreach ($after as $row) {
            $byIdAfter[(int)$row['reference_id']] = $row;
        }
        foreach ($byIdBefore as $id => $oldRow) {
            Assert::assertArrayHasKey($id, $byIdAfter);
            $allowedFields = [
                'reference_id', 'external_resource_id', 'resource_type', 'display_name', 'offering_id',
                'folder_id', 'order', 'created_at', 'updated_at', 'folio_instance_id',
            ];
            foreach (array_keys($byIdAfter[$id]) as $field) {
                Assert::assertContains($field, $allowedFields, 'Public response field must be allowlisted: ' . $field);
            }
            foreach ($oldRow as $field => $value) {
                Assert::assertSame($value, $byIdAfter[$id][$field], 'Existing public field ' . $field . ' must not change.');
            }
            if (in_array($id, $verifiedIds, true)) {
                Assert::assertNotEmpty($byIdAfter[$id]['folio_instance_id']);
            } else {
                Assert::assertArrayNotHasKey('folio_instance_id', $byIdAfter[$id]);
            }
            foreach (['identity_provenance_json', 'legacy_identifier', 'legacy_identifier_type', 'identity_status'] as $field) {
                Assert::assertArrayNotHasKey($field, $byIdAfter[$id]);
            }
        }
    }

    private function assertIdentityColumnsExist()
    {
        $columns = \Yii::$app->db->schema->getTableSchema('physical_resource_references', true)->columns;
        foreach (['folio_instance_id', 'legacy_identifier', 'legacy_identifier_type', 'identity_status', 'identity_provenance_json'] as $column) {
            Assert::assertArrayHasKey($column, $columns, 'Migration must add ' . $column . '.');
        }
        $indexes = \Yii::$app->db->schema->getTableIndexes('physical_resource_references', true);
        $hasExistingUniqueKey = false;
        foreach ($indexes as $index) {
            if ($index->unique && $index->columnNames === ['external_resource_id', 'offering_id']) {
                $hasExistingUniqueKey = true;
            }
        }
        Assert::assertTrue($hasExistingUniqueKey, 'Migration must preserve the external id/offering unique key.');
    }

    private function assertReferenceIdentity($externalId, $offeringId, $status, $instanceId)
    {
        $row = $this->reference($externalId, $offeringId);
        Assert::assertSame($status, $row['identity_status']);
        Assert::assertSame($instanceId, $row['folio_instance_id']);
    }

    private function reference($externalId, $offeringId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE external_resource_id = :external AND offering_id = :offering',
            [':external' => $externalId, ':offering' => $offeringId]
        )->queryOne();
    }

    private function referenceById($referenceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id', [':id' => $referenceId]
        )->queryOne();
    }

    private function referenceCount($referenceId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM physical_resource_references WHERE reference_id = :id', [':id' => $referenceId]
        )->queryScalar();
    }

    private function getOfferingReferences(FunctionalTester $I, $offeringId)
    {
        $I->deleteHeader('Authorization');
        $I->sendJsonRequest('GET', 'physical-resource/get-references?offering_id=' . $offeringId, []);
        $I->seeResponseCodeIs(200);
        return $this->response($I);
    }

    private function accessionFor($uuid)
    {
        return 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.'
            . substr($uuid, 0, 8) . '.' . substr($uuid, 9, 4) . '.' . substr($uuid, 14, 4) . '.'
            . substr($uuid, 19, 4) . '.' . substr($uuid, 24, 12);
    }

    private function cleanupApi113()
    {
        $db = \Yii::$app->db;
        if ($this->referenceIds) {
            $db->createCommand()->delete('physical_resource_references', ['reference_id' => $this->referenceIds])->execute();
        }
        if ($this->offeringIds) {
            $db->createCommand()->delete('physical_resource_references', ['offering_id' => $this->offeringIds])->execute();
        }
        foreach ($this->offeringIds as $offeringId) {
            $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringId])->execute();
        }
        foreach ($this->courseIds as $courseId) {
            $db->createCommand()->delete('courses', ['course_id' => $courseId])->execute();
        }
        $this->offeringIds = [];
        $this->courseIds = [];
        $this->referenceIds = [];
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

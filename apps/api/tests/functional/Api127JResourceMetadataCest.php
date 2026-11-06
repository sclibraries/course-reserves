<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;

/** Verifies resource metadata writes, explicit clears and atomic rejection. */
class Api127JResourceMetadataCest extends Api109FunctionalCest
{
    private $courseId;
    private $offeringId;

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        if ($this->resourceIds) {
            foreach (['resource_metadata', 'resource_links', 'course_resources'] as $table) {
                $db->createCommand()->delete($table, ['resource_id' => $this->resourceIds])->execute();
            }
        }
        parent::_after($I);
        if ($this->offeringId) {
            $db->createCommand()->delete('course_offerings', ['offering_id' => $this->offeringId])->execute();
            $this->offeringId = null;
        }
        if ($this->courseId) {
            $db->createCommand()->delete('courses', ['course_id' => $this->courseId])->execute();
            $this->courseId = null;
        }
    }

    public function testMetadataRoundTripsClearsAndRejectsInvalidValuesAtomically(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $resourceId = $this->createSource($this->materialTypeId('ebook'));
        $otherResourceId = $this->createSource($this->materialTypeId('ebook'));
        $courseResourceId = $this->createAssociation($resourceId);

        foreach ([
            ['omitted', 'Synthetic original omitted value'],
            ['clear_null', 'Synthetic duplicate null clear one'],
            ['clear_null', 'Synthetic duplicate null clear two'],
            ['clear_empty', 'Synthetic empty clear value'],
            ['updated', 'Synthetic original update value'],
        ] as $metadata) {
            $this->insertMetadata($resourceId, $metadata[0], $metadata[1]);
        }
        $this->insertMetadata($otherResourceId, 'clear_null', 'Synthetic other resource metadata');
        $db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://links.example.test/api127j-original',
            'title' => 'Synthetic original link',
            'description' => 'Synthetic original link description',
            'use_proxy' => 1,
            'order' => 1,
            'use_link_visibility' => 1,
            'start_visibility' => '2027-01-01',
            'end_visibility' => '2027-01-31',
        ])->execute();

        $this->request($I, 'PUT', 'resource/update', [
            'metadata' => [
                'yes' => 'Yes',
                'no' => 'No',
                'clear_null' => null,
                'clear_empty' => '',
                'clear_absent' => null,
                'updated' => 'Synthetic updated value',
                'zero' => '0',
            ],
        ], ['id' => $resourceId]);
        $I->seeResponseCodeIs(200);
        $expectedMetadata = [
            ['field_name' => 'no', 'field_value' => 'No'],
            ['field_name' => 'omitted', 'field_value' => 'Synthetic original omitted value'],
            ['field_name' => 'updated', 'field_value' => 'Synthetic updated value'],
            ['field_name' => 'yes', 'field_value' => 'Yes'],
            ['field_name' => 'zero', 'field_value' => '0'],
        ];
        Assert::assertSame($expectedMetadata, $this->metadataRows($resourceId));
        Assert::assertSame(
            [['field_name' => 'clear_null', 'field_value' => 'Synthetic other resource metadata']],
            $this->metadataRows($otherResourceId)
        );

        $this->request($I, 'PUT', 'resource/update', [
            'metadata' => ['clear_null' => null, 'clear_empty' => '', 'clear_absent' => null],
        ], ['id' => $resourceId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($expectedMetadata, $this->metadataRows($resourceId));

        $original = $this->resourceSnapshot($resourceId, $courseResourceId);
        foreach ([true, false, 0, [], '   '] as $invalidValue) {
            $this->request($I, 'PUT', 'resource/update', [
                'title' => 'Synthetic rejected title',
                'course_resource_id' => $courseResourceId,
                'start_visibility' => '2027-02-01',
                'metadata' => [
                    'yes' => 'Synthetic rejected metadata update',
                    'omitted' => null,
                    'invalid_api127j' => $invalidValue,
                ],
                'links' => [[
                    'url' => 'https://links.example.test/api127j-rejected',
                    'title' => 'Synthetic rejected link',
                ]],
            ], ['id' => $resourceId]);
            $status = is_string($invalidValue) ? 400 : 422;
            $I->seeResponseCodeIs($status);
            if ($status === 422) {
                Assert::assertStringContainsString('invalid_api127j', $this->response($I)['message']);
            }
            Assert::assertSame($original, $this->resourceSnapshot($resourceId, $courseResourceId));
        }
    }

    private function createAssociation($resourceId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('courses', [
            'course_name' => 'Synthetic API-127J course',
            'course_number' => 'TST 127J',
        ])->execute();
        $this->courseId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('course_offerings', [
            'course_id' => $this->courseId,
            'term_id' => 'api127j-' . bin2hex(random_bytes(4)),
            'term_name' => 'Fall 2027',
            'section_name' => '01',
        ])->execute();
        $this->offeringId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('course_resources', [
            'offering_id' => $this->offeringId,
            'resource_id' => $resourceId,
            'start_visibility' => '2027-01-01',
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function insertMetadata($resourceId, $field, $value)
    {
        \Yii::$app->db->createCommand()->insert('resource_metadata', [
            'resource_id' => $resourceId,
            'field_name' => $field,
            'field_value' => $value,
        ])->execute();
    }

    private function metadataRows($resourceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT field_name, field_value FROM resource_metadata WHERE resource_id = :id '
            . 'ORDER BY field_name, metadata_id', [':id' => $resourceId]
        )->queryAll();
    }

    private function resourceSnapshot($resourceId, $courseResourceId)
    {
        $db = \Yii::$app->db;
        return [
            'resource' => $db->createCommand(
                'SELECT name FROM resources WHERE resource_id = :id', [':id' => $resourceId]
            )->queryOne(),
            'association' => $db->createCommand(
                'SELECT start_visibility FROM course_resources WHERE course_resource_id = :id',
                [':id' => $courseResourceId]
            )->queryOne(),
            'metadata' => $this->metadataRows($resourceId),
            'links' => $db->createCommand(
                'SELECT url, title, description, use_proxy, `order`, use_link_visibility, start_visibility, end_visibility '
                . 'FROM resource_links WHERE resource_id = :id ORDER BY link_id', [':id' => $resourceId]
            )->queryAll(),
        ];
    }
}

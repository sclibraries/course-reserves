<?php

namespace tests\unit\services;

use app\services\SubmissionInputProjection;
use app\services\PublicationDraftSnapshot;
use app\services\SubmissionBibliographicFieldAliases;

class Api114ProjectionProtectionTest extends \Codeception\Test\Unit
{
    /** @group protection */
    public function testProtectionThreeSubmissionRepresentationsKeepEqualIdsAndKindsSeparate()
    {
        $projection = new SubmissionInputProjection();
        $representations = [
            ['new', 'ebook', [
                'id' => 114,
                'resource_data' => json_encode(['title' => 'Synthetic ordinary item']),
            ], 'Synthetic ordinary item'],
            ['new', 'ebook', [
                'id' => 114,
                'is_reuse' => 1,
                'source_resource_id' => '501',
                'resource_data' => json_encode(['title' => 'Synthetic new-table reuse']),
            ], 'Synthetic new-table reuse'],
            ['reuse', 'book', [
                'id' => 114,
                'source_resource_id' => 501,
                'source_snapshot_json' => json_encode(['title' => 'Synthetic legacy reuse']),
            ], 'Synthetic legacy reuse'],
        ];

        foreach ($representations as $representation) {
            list($kind, $type, $item, $expectedTitle) = $representation;
            $result = $projection->project($kind, $item, $type, null, true);

            $this->assertSame(114, $result['id']);
            $this->assertSame($kind, $result['kind']);
            $this->assertSame($expectedTitle, $result['inputs']['title']);
        }
    }

    /** @group protection */
    public function testProtectionExplicitItemClearsDoNotInheritAnotherCourseNotesOrPages()
    {
        $result = (new SubmissionInputProjection())->project('new', [
            'id' => 114,
            'material_type_id' => 9,
            'resource_data' => json_encode([
                'title' => 'Synthetic pending title',
                'public_note' => 'Must not inherit this faculty value',
                'assigned_pages' => 'Must not inherit these pages',
            ]),
            'source_snapshot_json' => json_encode([
                'public_note' => 'Another course note',
                'assigned_pages' => 'Another course pages',
            ]),
            'public_note' => null,
            'assigned_pages' => null,
        ], 'ebook', [
            'kind' => 'electronic',
            'resource' => [
                'external_note' => 'Published course note',
                'assigned_pages' => 'Published course pages',
            ],
        ], true);

        $this->assertNull($result['inputs']['public_note']);
        $this->assertNull($result['inputs']['assigned_pages']);
    }

    /** @group protection */
    public function testProtectionSameSourceKeepsPublicNotesAndAssignedPagesPerItem()
    {
        $projection = new SubmissionInputProjection();
        $first = $projection->project('new', [
            'id' => 114,
            'public_note' => 'Synthetic first course note',
            'assigned_pages' => '1-3',
        ], 'ebook', null, true);
        $second = $projection->project('reuse', [
            'id' => 114,
            'public_note' => 'Synthetic second course note',
            'assigned_pages' => '9-12',
        ], 'book', null, true);

        $this->assertSame('Synthetic first course note', $first['inputs']['public_note']);
        $this->assertSame('1-3', $first['inputs']['assigned_pages']);
        $this->assertSame('Synthetic second course note', $second['inputs']['public_note']);
        $this->assertSame('9-12', $second['inputs']['assigned_pages']);
    }

    public function testCopyInputsKeepBibliographicPagesDistinctFromAssignedPages()
    {
        $snapshot = PublicationDraftSnapshot::fromNewItem([
            'id' => 114,
            'material_type_id' => 9,
            'resource_data' => json_encode([
                'title' => 'Synthetic chapter',
                'pages' => '101-118',
            ]),
            'public_note' => 'Read the conclusion',
            'assigned_pages' => '108-112',
        ]);

        $this->assertSame('Read the conclusion', $snapshot['public_note']);
        $this->assertSame('108-112', $snapshot['assigned_pages']);
        $this->assertSame('101-118', $snapshot['copy_inputs']['bibliographic_metadata']['pages']);
    }

    /** @group protection */
    public function testProtectionSourceLessElectronicItemsKeepOnlyAllowlistedPendingLinks()
    {
        $result = (new SubmissionInputProjection())->project('new', [
            'id' => 114,
            'material_type_id' => 9,
            'resource_data' => json_encode([
                'links' => [[
                    'url' => 'https://links.example.test/source-less',
                    'title' => 'Synthetic submitted link',
                    'use_proxy' => 1,
                    'use_link_visibility' => 1,
                    'start_visibility' => '2027-02-01',
                    'private_link_property' => 'Synthetic private value',
                ]],
            ]),
        ], 'ebook', null, true);

        $this->assertSame([[
            'url' => 'https://links.example.test/source-less',
            'label' => 'Synthetic submitted link',
            'order' => 1,
            'use_proxy' => 1,
            'use_link_visibility' => 1,
            'start_visibility' => '2027-02-01',
            'end_visibility' => null,
        ]], $result['copy_inputs']['additional_links']);
        $this->assertStringNotContainsString('private_link_property', json_encode($result['copy_inputs']));
    }

    public function testEveryBibliographicAliasClearMatchesInputAndCopyProjection()
    {
        $aliases = SubmissionBibliographicFieldAliases::FIELDS;
        $this->assertSame([
            'title' => ['title', 'name', 'book_title', 'article_title', 'website_title'],
            'authors' => ['authors', 'author', 'author_editor', 'director_composer_performer', 'contributors'],
            'publisher' => ['publisher'],
            'publicationYear' => ['publicationYear', 'publication_year', 'publication_date', 'year'],
            'isbn' => ['isbn', 'ISBN'],
            'issn' => ['issn', 'ISSN'],
            'doi' => ['doi', 'DOI'],
        ], array_intersect_key($aliases, array_fill_keys([
            'title', 'authors', 'publisher', 'publicationYear', 'isbn', 'issn', 'doi',
        ], true)));

        $frozen = array_fill_keys(array_keys($aliases), 'Synthetic frozen bibliographic value');
        $projection = new SubmissionInputProjection();
        foreach ($aliases as $canonical => $fieldAliases) {
            $inputField = SubmissionBibliographicFieldAliases::inputField($canonical);
            foreach ($fieldAliases as $alias) {
                foreach ([null, ''] as $clear) {
                    $result = $projection->project('new', [
                        'id' => 114,
                        'material_type_id' => 9,
                        'resource_data' => json_encode([$alias => $clear]),
                        'source_snapshot_json' => json_encode([
                            'version' => 2,
                            'copy_inputs' => ['bibliographic_metadata' => $frozen],
                        ]),
                    ], 'ebook', null, true);

                    $this->assertNull(
                        $result['copy_inputs']['bibliographic_metadata'][$canonical],
                        'Copy inputs should honor clear alias ' . $alias . '.'
                    );
                    if ($inputField !== null) {
                        $this->assertNull(
                            $result['inputs'][$inputField],
                            'Pending inputs should honor clear alias ' . $alias . '.'
                        );
                    }
                }
            }
        }
    }
}

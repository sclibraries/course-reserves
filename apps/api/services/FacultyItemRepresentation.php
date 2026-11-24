<?php

namespace app\services;

use app\models\FacultySubmission;

/** Builds the faculty-safe item view from rows and evidence already read in bulk. */
class FacultyItemRepresentation
{
    private const RESOURCE_FIELDS = [
        'authors' => 'authors',
        'publisher' => 'publisher',
        'publicationYear' => 'publicationYear',
        'isbn' => 'isbn',
        'issn' => 'issn',
        'doi' => 'doi',
        'edition' => 'edition',
        'oclcNumber' => 'oclcNumber',
        'journalTitle' => 'journalTitle',
        'volume' => 'volume',
        'issue' => 'issue',
        'pages' => 'pages',
        'url' => 'url',
        'displayStartDate' => 'displayStartDate',
        'displayEndDate' => 'displayEndDate',
        'instance_hrid' => 'instanceHrid',
        'chapter_title' => 'chapterTitle',
        'copy' => 'copy',
        'temporary_location_id' => 'temporaryLocationId',
        'permanent_location_id' => 'permanentLocationId',
    ];

    private $lockPredicate;

    public function __construct($now)
    {
        $this->lockPredicate = new FacultyItemLockPredicate($now);
    }

    public function represent(
        FacultySubmission $submission,
        array $folders,
        array $itemsByKind,
        array $evidence
    ): array {
        $grouped = (new FacultyFolderGrouping())->group($folders, $itemsByKind);
        $folderRows = [];
        foreach ($folders as $folder) {
            $folderRows[(int)$folder['folder_id']] = $folder;
        }
        $rowsByKind = ['new' => [], 'reuse' => []];
        foreach ($itemsByKind as $kind => $rows) {
            foreach ($rows as $row) {
                $rowsByKind[$kind][(int)$row['id']] = $row;
            }
        }
        $resultFolders = [];
        foreach ($grouped['folders'] as $folder) {
            $row = $folderRows[$folder['folder_id']];
            $resultFolders[] = [
                'folder_id' => $folder['folder_id'],
                'name' => $row['folder_name'],
                'display_order' => self::integerOrNull($row['display_order']),
                'ambiguous' => $folder['ambiguous'],
                'items' => array_map(function ($reference) use (
                    $submission,
                    $rowsByKind,
                    $evidence,
                    $folder
                ) {
                    return $this->item(
                        $submission,
                        $rowsByKind[$reference['kind']][$reference['id']],
                        $reference['kind'],
                        $folder['folder_id'],
                        $folder['ambiguous'],
                        $evidence
                    );
                }, $folder['items']),
            ];
        }

        $rootItems = array_map(function ($reference) use ($submission, $rowsByKind, $evidence) {
            return $this->item(
                $submission,
                $rowsByKind[$reference['kind']][$reference['id']],
                $reference['kind'],
                null,
                false,
                $evidence
            );
        }, $grouped['root']);

        return ['folders' => $resultFolders, 'unfoldered_items' => $rootItems];
    }

    private function item(
        FacultySubmission $submission,
        array $row,
        $kind,
        $folderId,
        $ambiguousFolder,
        array $evidence
    ): array {
        $data = json_decode($row['resource_data'] ?? '', true);
        $data = is_array($data) ? $data : [];
        $id = (int)$row['id'];
        $itemEvidence = $evidence[$kind][$id] ?? [];
        $lock = $this->lockPredicate->evaluate(
            $submission,
            $kind,
            $row,
            array_replace([
                'open_run' => false,
                'publication_history' => false,
                'published' => false,
                'open_review' => false,
            ], $itemEvidence),
            $ambiguousFolder
        );
        $resourceFields = [];
        foreach (self::RESOURCE_FIELDS as $outputKey => $dataKey) {
            $resourceFields[$outputKey] = $outputKey === 'journalTitle'
                ? (array_key_exists('journal', $data) ? $data['journal'] : ($data['journalTitle'] ?? null))
                : ($data[$dataKey] ?? null);
        }
        return [
            'kind' => $kind,
            'id' => $id,
            'folder_id' => self::integerOrNull($folderId),
            'folder_name' => $row['folder_name'],
            'position' => self::integerOrNull($row['position_in_folder']),
            'display_order' => self::integerOrNull($row['display_order']),
            'is_reuse' => $kind === 'reuse' || (bool)$row['is_reuse'],
            'status' => $row['item_status'],
            'title' => $data['title'] ?? $row['source_resource_name'] ?? 'Untitled',
            'authors' => $resourceFields['authors'],
            'publisher' => $resourceFields['publisher'],
            'publicationYear' => $resourceFields['publicationYear'],
            'isbn' => $resourceFields['isbn'],
            'issn' => $resourceFields['issn'],
            'doi' => $resourceFields['doi'],
            'edition' => $resourceFields['edition'],
            'oclcNumber' => $resourceFields['oclcNumber'],
            'journalTitle' => $resourceFields['journalTitle'],
            'volume' => $resourceFields['volume'],
            'issue' => $resourceFields['issue'],
            'pages' => $resourceFields['pages'],
            'url' => $resourceFields['url'],
            'displayStartDate' => $resourceFields['displayStartDate'],
            'displayEndDate' => $resourceFields['displayEndDate'],
            'material_type' => $row['material_type_name'] !== null
                ? EffectiveMaterialType::key($row, $row['material_type_name'])
                : null,
            'assignedPages' => $row['assigned_pages'],
            'faculty_notes' => $row['faculty_notes'],
            'barcode' => $kind === 'reuse'
                ? $row['barcode']
                : ((bool)$row['is_reuse'] ? $row['source_barcode'] : ($data['barcode'] ?? null)),
            'call_number' => $kind === 'reuse'
                ? $row['call_number']
                : ((bool)$row['is_reuse'] ? $row['source_call_number'] : ($data['callNumber'] ?? null)),
            'eds' => self::nestedData($data, 'eds', ['dbId', 'an', 'plink']),
            'source_resource_id' => $row['source_resource_id'],
            'source_folio_instance_id' => $row['source_folio_instance_id'],
            'instance_id' => $data['instanceId'] ?? $row['source_folio_instance_id'],
            'instance_hrid' => $resourceFields['instance_hrid'],
            'holdings_id' => $data['holdingsId'] ?? $row['source_folio_holdings_id'],
            'chapter_title' => $resourceFields['chapter_title'],
            'copy' => $resourceFields['copy'],
            'temporary_location_id' => $resourceFields['temporary_location_id'],
            'permanent_location_id' => $resourceFields['permanent_location_id'],
            'temporary_location' => self::nestedData($data, 'temporaryLocationObject', ['id', 'name', 'code']),
            'permanent_location' => self::nestedData($data, 'permanentLocationObject', ['id', 'name', 'code']),
            'lock' => [
                'locked' => $lock['locked'],
                'kind' => $lock['lock'],
                'reason' => $lock['message'],
            ],
            'capabilities' => $lock['capabilities'],
        ];
    }

    private static function nestedData(array $data, $key, array $fields)
    {
        if (!isset($data[$key]) || !is_array($data[$key])) {
            return null;
        }
        $value = [];
        foreach ($fields as $field) {
            $value[$field] = $data[$key][$field] ?? null;
        }
        return $value;
    }

    private static function integerOrNull($value)
    {
        return $value === null ? null : (int)$value;
    }
}

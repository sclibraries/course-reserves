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
        $folderRows = array_column($folders, null, 'folder_id');
        $rowsByKind = [
            'new' => array_column($itemsByKind['new'] ?? [], null, 'id'),
            'reuse' => array_column($itemsByKind['reuse'] ?? [], null, 'id'),
        ];
        $resultFolders = array_map(function ($folder) use ($submission, $folderRows, $rowsByKind, $evidence) {
            $row = $folderRows[$folder['folder_id']];
            return [
                'folder_id' => $folder['folder_id'],
                'name' => $row['folder_name'],
                'display_order' => self::integerOrNull($row['display_order']),
                'ambiguous' => $folder['ambiguous'],
                'items' => $this->itemsForReferences(
                    $folder['items'], $submission, $rowsByKind, $evidence, $folder['folder_id'], $folder['ambiguous']
                ),
            ];
        }, $grouped['folders']);

        return [
            'folders' => $resultFolders,
            'unfoldered_items' => $this->itemsForReferences(
                $grouped['root'], $submission, $rowsByKind, $evidence, null, false
            ),
        ];
    }

    private function itemsForReferences(
        array $references,
        FacultySubmission $submission,
        array $rowsByKind,
        array $evidence,
        $folderId,
        $ambiguousFolder
    ): array {
        return array_map(function ($reference) use ($submission, $rowsByKind, $evidence, $folderId, $ambiguousFolder) {
            return $this->item(
                $submission,
                $rowsByKind[$reference['kind']][$reference['id']],
                $reference['kind'],
                $folderId,
                $ambiguousFolder,
                $evidence
            );
        }, $references);
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
        $lock = $this->lockPredicate->evaluate(
            $submission,
            $kind,
            $row,
            $evidence[$kind][$id],
            $ambiguousFolder
        );
        $values = [];
        foreach (self::RESOURCE_FIELDS as $name => $key) {
            $values[$name] = $data[$key] ?? null;
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
            'journalTitle' => array_key_exists('journal', $data)
                ? $data['journal']
                : ($data['journalTitle'] ?? null),
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
            'holdings_id' => $data['holdingsId'] ?? $row['source_folio_holdings_id'],
            'temporary_location' => self::nestedData($data, 'temporaryLocationObject', ['id', 'name', 'code']),
            'permanent_location' => self::nestedData($data, 'permanentLocationObject', ['id', 'name', 'code']),
            'lock' => ['locked' => $lock['locked'], 'kind' => $lock['lock'], 'reason' => $lock['message']],
            'capabilities' => $lock['capabilities'],
        ] + $values;
    }

    private static function nestedData(array $data, $key, array $fields)
    {
        return isset($data[$key]) && is_array($data[$key])
            ? array_combine($fields, array_map(function ($field) use ($data, $key) {
                return $data[$key][$field] ?? null;
            }, $fields))
            : null;
    }

    private static function integerOrNull($value)
    {
        return $value === null ? null : (int)$value;
    }
}

<?php

namespace app\services;

/** Builds the allowlisted draft input without writing a destination. */
class SubmissionInputProjection
{
    public const RESOURCE_DATA_FIELDS = [
        'title' => ['title', 'name'],
        'authors' => ['authors', 'author', 'contributors'],
        'publisher' => ['publisher'],
        'publication_year' => ['publicationYear', 'publication_year', 'year'],
        'isbn' => ['isbn', 'ISBN'],
        'issn' => ['issn', 'ISSN'],
        'doi' => ['doi', 'DOI'],
        'database' => ['database', 'databaseName', 'database_name'],
        'accession_number' => ['accessionNumber', 'accession_number'],
        'record_url' => ['recordUrl', 'record_url', 'pLink'],
        'url' => ['fullTextUrl', 'url', 'item_url', 'link'],
        'description' => ['description', 'abstract'],
        'display_start_date' => ['displayStartDate', 'startVisibility', 'start_visibility'],
        'display_end_date' => ['displayEndDate', 'endVisibility', 'end_visibility'],
        'use_proxy' => ['useProxy', 'use_proxy'],
    ];

    public function project($kind, array $item, $materialTypeName, $publishedSnapshot = null, $sourceExists = null)
    {
        $resourceData = $this->decode($item['resource_data'] ?? null);
        $corrections = $this->decode($item['staff_corrections_json'] ?? null);
        $source = $this->decode($item['source_snapshot_json'] ?? null);
        $published = $this->publishedResource($publishedSnapshot);
        $inputs = [];

        foreach (self::RESOURCE_DATA_FIELDS as $field => $aliases) {
            $inputs[$field] = $this->field($field, $aliases, $corrections, $resourceData, $source, $published);
        }
        foreach (['public_note', 'assigned_pages'] as $field) {
            $inputs[$field] = $this->itemField($field, $item, $corrections, $resourceData, $source, $published);
        }
        $copyInputs = $this->copyInputs($resourceData, $corrections, $source, $inputs);

        $typeId = EffectiveMaterialType::id($item);
        $typeKey = EffectiveMaterialType::key($item, $materialTypeName);
        $destinationClass = $this->destinationClass($typeKey, $item);
        $blockers = [];
        if ($typeKey === null) {
            $blockers[] = 'unknown_material_type';
            $destinationClass = null;
        } elseif ($destinationClass === null) {
            $blockers[] = 'destination_class_required';
        }
        $resourceId = $item['source_resource_id'] ?? null;
        if ($sourceExists === null) {
            $sourceExists = !empty($source) || !$this->hasValue($resourceId);
        }
        if ($this->hasValue($resourceId) && !$sourceExists) {
            $blockers[] = 'source_resource_missing';
        }
        if ($this->copyInputsIncomplete($source, $resourceId)) {
            $blockers[] = 'copy_inputs_incomplete';
        }
        $identityItem = $item;
        $identityItem['destination_class'] = $destinationClass;
        $identity = (new PhysicalResourceReferenceIdentity())->resolve($kind, $identityItem);
        $blockers = array_merge($blockers, $identity['blockers']);

        return [
            'kind' => $kind,
            'id' => (int)($item['id'] ?? 0),
            'inputs' => $inputs,
            'copy_inputs' => $copyInputs,
            'effective_material_type' => [
                'id' => $typeId,
                'key' => $typeKey,
                'name' => $typeKey,
            ],
            'destination_class' => $destinationClass,
            'access_path' => $item['access_path'] ?? null,
            'source' => [
                'resource_id' => $this->stringValue($resourceId),
                'folio_instance_id' => $this->stringValue($item['source_folio_instance_id'] ?? null),
                'folio_holdings_id' => $this->folioHoldingsId($item, $resourceData),
            ],
            'blockers' => array_values(array_unique($blockers)),
        ];
    }

    private function copyInputs(array $resourceData, array $corrections, array $source, array $inputs)
    {
        $frozen = isset($source['copy_inputs']) && is_array($source['copy_inputs'])
            ? $source['copy_inputs']
            : [];
        $frozenPrimary = isset($frozen['primary_link']) && is_array($frozen['primary_link'])
            ? $frozen['primary_link']
            : [];
        $primaryVisibility = $this->pendingOrFrozen(
            ['use_primary_link_visibility', 'usePrimaryLinkVisibility'],
            'use_primary_link_visibility', $resourceData, $frozenPrimary
        );
        $primaryStart = $this->pendingOrFrozen(
            ['primary_link_start_visibility', 'primaryLinkStartVisibility'],
            'primary_link_start_visibility', $resourceData, $frozenPrimary
        );
        $primaryEnd = $this->pendingOrFrozen(
            ['primary_link_end_visibility', 'primaryLinkEndVisibility'],
            'primary_link_end_visibility', $resourceData, $frozenPrimary
        );

        $metadata = array_fill_keys(array_keys(SubmissionSourceSnapshot::BIBLIOGRAPHIC_FIELDS), null);
        $frozenMetadata = isset($frozen['bibliographic_metadata']) && is_array($frozen['bibliographic_metadata'])
            ? $frozen['bibliographic_metadata']
            : [];
        $inputFields = [
            'title' => 'title', 'authors' => 'authors', 'publisher' => 'publisher',
            'publicationYear' => 'publication_year', 'isbn' => 'isbn', 'issn' => 'issn', 'doi' => 'doi',
        ];
        foreach (SubmissionSourceSnapshot::BIBLIOGRAPHIC_FIELDS as $field => $aliases) {
            $correctionField = $field === 'publicationYear' ? 'publication_year' : $field;
            if (array_key_exists($correctionField, $corrections)) {
                $metadata[$field] = $this->normalize($corrections[$correctionField]);
                continue;
            }
            list($found, $value) = $this->firstValue($resourceData, $aliases);
            if ($found) {
                $metadata[$field] = $this->normalize($value);
            } elseif (array_key_exists($field, $frozenMetadata)) {
                $metadata[$field] = $this->normalize($frozenMetadata[$field]);
            } elseif (array_key_exists($field, $source)) {
                $metadata[$field] = $this->normalize($source[$field]);
            } elseif (isset($inputFields[$field])) {
                $metadata[$field] = $inputs[$inputFields[$field]];
            }
        }

        return [
            'primary_link' => [
                'url' => $inputs['url'],
                'use_proxy' => $this->flag($inputs['use_proxy']),
                'use_primary_link_visibility' => $this->flag($primaryVisibility),
                'primary_link_start_visibility' => $this->normalize($primaryStart),
                'primary_link_end_visibility' => $this->normalize($primaryEnd),
            ],
            'additional_links' => isset($frozen['additional_links']) && is_array($frozen['additional_links'])
                ? $frozen['additional_links']
                : [],
            'bibliographic_metadata' => $metadata,
        ];
    }

    private function pendingOrFrozen(array $aliases, $field, array $resourceData, array $frozen)
    {
        list($found, $value) = $this->firstValue($resourceData, $aliases);
        if ($found) {
            return $value;
        }
        return $frozen[$field] ?? null;
    }

    private function copyInputsIncomplete(array $source, $resourceId)
    {
        if (!$source) {
            return $this->hasValue($resourceId);
        }
        if (!array_key_exists('version', $source)) {
            return false;
        }
        if ((int)$source['version'] < 2 || !isset($source['copy_inputs']) || !is_array($source['copy_inputs'])) {
            return true;
        }
        return !isset($source['copy_inputs']['primary_link'])
            || !isset($source['copy_inputs']['additional_links'])
            || !isset($source['copy_inputs']['bibliographic_metadata']);
    }

    private function flag($value)
    {
        return in_array($value, [true, 1, '1'], true) ? 1 : 0;
    }

    private function field($field, array $aliases, array $corrections, array $resourceData, array $source, array $published)
    {
        if (array_key_exists($field, $corrections)) {
            return $this->normalize($corrections[$field]);
        }
        list($found, $value) = $this->firstValue($resourceData, $aliases);
        if ($found) {
            return $this->normalize($value);
        }
        if (array_key_exists($field, $source)) {
            return $this->normalize($source[$field]);
        }
        if (array_key_exists($field, $published)) {
            return $this->normalize($published[$field]);
        }
        return null;
    }

    private function itemField($field, array $item, array $corrections, array $resourceData, array $source, array $published)
    {
        if (array_key_exists($field, $corrections)) {
            return $this->normalize($corrections[$field]);
        }
        if (array_key_exists($field, $item)) {
            return $this->normalize($item[$field]);
        }
        return $this->field($field, [$field], $corrections, $resourceData, $source, $published);
    }

    private function destinationClass($typeKey, array $item)
    {
        if ($typeKey === 'book') {
            return 'print';
        }
        if (in_array($typeKey, ['ebook', 'article', 'chapter', 'website'], true)) {
            return 'electronic';
        }
        if (in_array($typeKey, ['video', 'other'], true)) {
            $choice = $item['destination_class_choice'] ?? null;
            if (in_array($choice, ['electronic', 'print'], true)) {
                return $choice;
            }
            // Only an instance id is a FOLIO identity; barcodes and holdings ids are distinct.
            return $this->hasValue($item['source_folio_instance_id'] ?? null) ? 'print' : null;
        }
        return null;
    }

    private function publishedResource($snapshot)
    {
        $snapshot = $this->decode($snapshot);
        $resource = isset($snapshot['resource']) && is_array($snapshot['resource'])
            ? $snapshot['resource']
            : [];
        $mapped = [];
        foreach ([
            'title' => 'name',
            'url' => 'item_url',
            'description' => 'description',
            'display_start_date' => 'start_visibility',
            'display_end_date' => 'end_visibility',
            'use_proxy' => 'use_proxy',
        ] as $field => $sourceField) {
            if (array_key_exists($sourceField, $resource)) {
                $mapped[$field] = $resource[$sourceField];
            }
        }
        return $mapped;
    }

    private function firstValue(array $source, array $keys)
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $source)) {
                return [true, $source[$key]];
            }
        }
        return [false, null];
    }

    private function decode($value)
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return is_array($value) ? $value : [];
    }

    private function normalize($value)
    {
        return is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
    }

    private function stringValue($value)
    {
        return $value === null || $value === '' ? null : (string)$value;
    }

    private function folioHoldingsId(array $item, array $resourceData)
    {
        foreach (['source_folio_holdings_id', 'folio_holdings_id', 'holdingsId', 'holdings_id'] as $field) {
            if (array_key_exists($field, $item) && $this->hasValue($item[$field])) {
                return $this->stringValue($item[$field]);
            }
            if (array_key_exists($field, $resourceData) && $this->hasValue($resourceData[$field])) {
                return $this->stringValue($resourceData[$field]);
            }
        }
        return null;
    }

    private function hasValue($value)
    {
        return $value !== null && trim((string)$value) !== '';
    }
}

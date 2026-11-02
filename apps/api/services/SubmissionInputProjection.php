<?php

namespace app\services;

/** Builds the allowlisted draft input without writing a destination. */
class SubmissionInputProjection
{
    public function project($kind, array $item, $materialTypeName, $publishedSnapshot = null, $sourceExists = null)
    {
        $resourceData = $this->decode($item['resource_data'] ?? null);
        $corrections = $this->decode($item['staff_corrections_json'] ?? null);
        $source = $this->decode($item['source_snapshot_json'] ?? null);
        $published = $this->publishedResource($publishedSnapshot);
        $inputs = [];

        foreach (SubmissionBibliographicFieldAliases::resourceDataFields() as $field => $aliases) {
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
        $canonicalResourceId = SourceResourceId::canonical($resourceId);
        if ($sourceExists === null) {
            $sourceExists = $canonicalResourceId === null || !empty($source);
        }
        if ($canonicalResourceId !== null && !$sourceExists) {
            $blockers[] = 'source_resource_missing';
        }
        if ($destinationClass === 'electronic' && $canonicalResourceId !== null && $sourceExists
            && $this->copyInputsIncomplete($source)) {
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
                'resource_id' => $canonicalResourceId === null ? null : (string)$canonicalResourceId,
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
        list(, $primaryVisibility) = $this->firstValue(
            $resourceData, ['use_primary_link_visibility', 'usePrimaryLinkVisibility']
        );
        list(, $primaryStart) = $this->firstValue(
            $resourceData, ['primary_link_start_visibility', 'primaryLinkStartVisibility']
        );
        list(, $primaryEnd) = $this->firstValue(
            $resourceData, ['primary_link_end_visibility', 'primaryLinkEndVisibility']
        );

        $metadata = array_fill_keys(array_keys(SubmissionBibliographicFieldAliases::FIELDS), null);
        $frozenMetadata = isset($frozen['bibliographic_metadata']) && is_array($frozen['bibliographic_metadata'])
            ? $frozen['bibliographic_metadata']
            : [];
        foreach (SubmissionBibliographicFieldAliases::FIELDS as $field => $aliases) {
            $correctionField = $field === 'publicationYear' ? 'publication_year' : $field;
            if (array_key_exists($correctionField, $corrections)) {
                $metadata[$field] = $this->normalize($corrections[$correctionField]);
                continue;
            }
            list($found, $value) = SubmissionBibliographicFieldAliases::firstPresent($resourceData, $field);
            if ($found) {
                $metadata[$field] = $this->normalize($value);
            } elseif (array_key_exists($field, $frozenMetadata)) {
                $metadata[$field] = $this->normalize($frozenMetadata[$field]);
            } elseif (array_key_exists($field, $source)) {
                $metadata[$field] = $this->normalize($source[$field]);
            } elseif (SubmissionBibliographicFieldAliases::inputField($field) !== null) {
                $metadata[$field] = $inputs[SubmissionBibliographicFieldAliases::inputField($field)];
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
            'additional_links' => array_key_exists('links', $resourceData)
                ? $this->additionalLinks(is_array($resourceData['links']) ? $resourceData['links'] : [])
                : (isset($frozen['additional_links']) && is_array($frozen['additional_links'])
                    ? $frozen['additional_links']
                    : []),
            'bibliographic_metadata' => $metadata,
        ];
    }

    private function additionalLinks(array $links)
    {
        $projected = [];
        foreach ($links as $index => $link) {
            if (!is_array($link)) {
                continue;
            }
            list(, $url) = $this->firstValue($link, ['url', 'link']);
            $url = $this->normalize($url);
            if (!is_string($url) || $url === '') {
                continue;
            }
            list(, $label) = $this->firstValue($link, ['title', 'label']);
            list(, $order) = $this->firstValue($link, ['order']);
            list(, $useProxy) = $this->firstValue($link, ['use_proxy', 'useProxy']);
            list(, $useVisibility) = $this->firstValue(
                $link, ['use_link_visibility', 'useLinkVisibility']
            );
            list(, $start) = $this->firstValue($link, ['start_visibility', 'startVisibility']);
            list(, $end) = $this->firstValue($link, ['end_visibility', 'endVisibility']);
            $projected[] = [
                'url' => $url,
                'label' => $this->normalize($label),
                'order' => is_numeric($order) ? (int)$order : (int)$index + 1,
                'use_proxy' => $this->flag($useProxy),
                'use_link_visibility' => $this->flag($useVisibility),
                'start_visibility' => $this->normalize($start),
                'end_visibility' => $this->normalize($end),
            ];
        }
        return $projected;
    }

    private function copyInputsIncomplete(array $source)
    {
        return isset($source['version']) && (int)$source['version'] === 1;
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
        $canonical = SubmissionBibliographicFieldAliases::canonicalForInput($field);
        if ($canonical === null) {
            list($found, $value) = $this->firstValue($resourceData, $aliases);
        } else {
            list($found, $value) = SubmissionBibliographicFieldAliases::firstPresent($resourceData, $canonical);
        }
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

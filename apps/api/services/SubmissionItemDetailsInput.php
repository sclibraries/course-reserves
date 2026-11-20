<?php

namespace app\services;

/** Normalizes the pure staff item-details payload and merges its corrections. */
class SubmissionItemDetailsInput
{
    public static function normalize(array $payload)
    {
        $details = [];
        foreach (['public_note', 'assigned_pages'] as $field) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }
            $value = $payload[$field];
            if ($value !== null && !is_string($value)) {
                return ['error_code' => 'invalid_item_detail', 'field' => $field];
            }
            $value = $value === null ? null : trim($value);
            if ($value !== null && strlen($value) > 65535) {
                return ['error_code' => 'item_detail_too_long', 'field' => $field];
            }
            $details[$field] = $value === '' ? null : $value;
        }
        if (array_key_exists('effective_material_type_id', $payload)) {
            $value = $payload['effective_material_type_id'];
            if ($value === null || $value === '') {
                $details['staff_material_type_id'] = null;
            } elseif ((is_int($value) || (is_string($value) && ctype_digit($value))) && (int)$value > 0) {
                $details['staff_material_type_id'] = (int)$value;
            } else {
                return ['error_code' => 'invalid_item_detail', 'field' => 'effective_material_type_id'];
            }
        }
        if (array_key_exists('destination_class_choice', $payload)) {
            $value = $payload['destination_class_choice'];
            if ($value === null || $value === '') {
                $details['destination_class_choice'] = null;
            } elseif (is_string($value) && in_array($value, ['electronic', 'print'], true)) {
                $details['destination_class_choice'] = $value;
            } else {
                return ['error_code' => 'invalid_item_detail', 'field' => 'destination_class_choice'];
            }
        }
        if (array_key_exists('corrections', $payload)) {
            if (!is_array($payload['corrections'])) {
                return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
            }
            $corrections = [];
            $allowed = array_keys(SubmissionBibliographicFieldAliases::resourceDataFields());
            foreach ($payload['corrections'] as $field => $value) {
                if (!in_array($field, $allowed, true)) {
                    return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
                }
                $normalized = self::normalizeCorrection($field, $value);
                if (is_array($normalized) && isset($normalized['error_code'])) {
                    return $normalized;
                }
                $corrections[$field] = $normalized;
            }
            $details['staff_corrections_json'] = json_encode(self::sortKeys($corrections), JSON_UNESCAPED_SLASHES);
        }
        return $details;
    }

    public static function mergeCorrections(array $item, array &$details)
    {
        if (!array_key_exists('staff_corrections_json', $details)) {
            return;
        }
        $current = self::decodeMap($item['staff_corrections_json'] ?? null);
        $submitted = self::decodeMap($details['staff_corrections_json']);
        $details['staff_corrections_json'] = json_encode(
            self::sortKeys(array_merge($current, $submitted)), JSON_UNESCAPED_SLASHES
        );
    }

    private static function normalizeCorrection($field, $value)
    {
        if ($value === null) {
            return null;
        }
        if ($field === 'use_proxy') {
            if (in_array($value, [true, 1, '1'], true)) {
                return 1;
            }
            if (in_array($value, [false, 0, '0'], true)) {
                return 0;
            }
            return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
        }
        if ($field === 'authors' && is_array($value)) {
            foreach ($value as $author) {
                if ($author !== null && !is_scalar($author)) {
                    return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
                }
            }
            return array_map(function ($author) {
                return is_string($author) ? trim($author) : $author;
            }, $value);
        }
        if (!is_scalar($value)) {
            return ['error_code' => 'invalid_item_detail', 'field' => 'corrections'];
        }
        $value = trim((string)$value);
        return $value === '' ? null : $value;
    }

    private static function decodeMap($value)
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return is_array($value) ? $value : [];
    }

    private static function sortKeys(array $value)
    {
        foreach ($value as &$child) {
            if (is_array($child)) {
                $child = self::sortKeys($child);
            }
        }
        unset($child);
        if (array_keys($value) !== range(0, count($value) - 1)) {
            ksort($value);
        }
        return $value;
    }
}

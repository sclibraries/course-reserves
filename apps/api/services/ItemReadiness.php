<?php

namespace app\services;

use app\components\FolioInstanceId;

/** Applies the course-reserve item readiness rule to stored item data. */
class ItemReadiness
{
    public static function evaluate(array $item, $availability = null)
    {
        return self::evaluateWithCatalogInstanceId($item, $availability, self::catalogInstanceId($item));
    }

    public static function evaluateWithCatalogInstanceId(array $item, $availability, $instanceId)
    {
        $data = self::resourceData($item['resource_data'] ?? null);
        if (self::hasOnlineAccess($item, $data)) {
            return self::result('ready', 'Online access is available.');
        }

        if ($instanceId === null) {
            return self::result('unknown', 'No catalog identity.');
        }

        if (!is_array($availability) || !empty($availability['error'])) {
            return self::result('unknown', 'Availability could not be checked.');
        }

        foreach ($availability as $copy) {
            if (isset($copy['status']) && strtolower(trim($copy['status'])) === 'available') {
                return self::result('ready', 'Available at a Five College library.');
            }
        }

        return self::result('missing', 'No available Five College copy or online access.');
    }

    public static function catalogInstanceId(array $item, array $data = null)
    {
        $data = $data === null ? self::resourceData($item['resource_data'] ?? null) : $data;
        $instanceId = $item['source_folio_instance_id'] ?? $data['instanceId'] ?? null;
        if (is_string($instanceId) && trim($instanceId) !== '') {
            return trim($instanceId);
        }

        $eds = isset($data['eds']) && is_array($data['eds']) ? $data['eds'] : [];
        return FolioInstanceId::fromAccessionNumber($eds['an'] ?? null);
    }

    private static function hasOnlineAccess(array $item, array $data)
    {
        $url = $data['url'] ?? ($item['sourceResource']['item_url'] ?? null);
        $eds = isset($data['eds']) && is_array($data['eds']) ? $data['eds'] : [];
        $accessionNumber = $eds['an'] ?? '';

        return (is_string($url) && trim($url) !== '')
            || !empty($data['hasFullText'])
            || strtolower((string)($eds['dbId'] ?? '')) === 'cat09114a'
            || (is_string($accessionNumber) && stripos($accessionNumber, 'smc.') === 0);
    }

    private static function resourceData($value)
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || $value === '') {
            return [];
        }

        $data = json_decode($value, true);
        return is_array($data) ? $data : [];
    }

    private static function result($readiness, $reason)
    {
        return ['readiness' => $readiness, 'readiness_reason' => $reason];
    }
}

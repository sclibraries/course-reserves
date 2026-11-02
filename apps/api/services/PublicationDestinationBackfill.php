<?php

namespace app\services;

use Yii;

/** Preserves existing materialized destinations as unowned registry attachments. */
class PublicationDestinationBackfill
{
    private $db;
    private $snapshots;

    private const OUTCOMES = [
        'attached', 'missing_entry', 'mismatch', 'other_offering', 'unresolved',
        'ambiguous', 'conflict', 'incomplete', 'no_offering',
    ];

    public function __construct($db = null, ?PublicationDestinationSnapshot $snapshots = null)
    {
        $this->db = $db ?: Yii::$app->db;
        $this->snapshots = $snapshots ?: new PublicationDestinationSnapshot($this->db);
    }

    public function run()
    {
        $counts = array_fill_keys(self::OUTCOMES, 0);
        foreach ([
            'submission_new_resources' => 'new',
            'submission_reuse_resources' => 'reuse',
        ] as $table => $kind) {
            $items = $this->db->createCommand(
                'SELECT item.*, submission.offering_id FROM ' . $table . ' item '
                . 'INNER JOIN faculty_submissions submission ON submission.submission_id = item.submission_id'
            )->queryAll();
            foreach ($items as $item) {
                if ($this->hasAttachment($kind, $item['id'])) {
                    continue;
                }
                $result = $this->classify($kind, $item);
                if ($result === null) {
                    continue;
                }
                $category = $result['category'];
                if ($category === 'attached') {
                    $this->attach($kind, $item['id'], $result);
                }
                $counts[$category]++;
            }
        }

        echo 'API-116A backfill: ' . implode(' ', array_map(function ($category) use ($counts) {
            return $category . '=' . $counts[$category];
        }, self::OUTCOMES)) . PHP_EOL;
        return $counts;
    }

    private function classify($kind, array $item)
    {
        $resourceMarker = $item['materialized_resource_id'] ?? null;
        $courseMarker = $item['materialized_course_resource_id'] ?? null;
        $physicalMarker = $item['materialized_physical_reference_id'] ?? null;
        $electronic = $resourceMarker !== null || $courseMarker !== null;
        $physical = $physicalMarker !== null;
        $metadata = ($item['materialized_folder_id'] ?? null) !== null
            || ($item['materialized_at'] ?? null) !== null
            || ($item['materialized_by_staff_id'] ?? null) !== null;

        if (!$electronic && !$physical && !$metadata) {
            return null;
        }
        if ($electronic && $physical) {
            return ['category' => 'conflict'];
        }
        if (empty($item['offering_id'])) {
            return ['category' => 'no_offering'];
        }
        if ($electronic) {
            return $this->classifyElectronic($item, $resourceMarker, $courseMarker);
        }
        if ($physical) {
            return $this->classifyPhysical($kind, $item, $physicalMarker);
        }
        return ['category' => 'incomplete'];
    }

    private function classifyElectronic(array $item, $resourceMarker, $courseMarker)
    {
        if ($resourceMarker === null || $courseMarker === null) {
            return ['category' => 'incomplete'];
        }
        $courseResourceId = SourceResourceId::canonical($courseMarker);
        $resourceId = SourceResourceId::canonical($resourceMarker);
        if ($courseResourceId === null) {
            return ['category' => 'missing_entry'];
        }
        $entry = $this->snapshots->electronic($courseResourceId);
        if ($entry === null) {
            return ['category' => 'missing_entry'];
        }
        if ($resourceId === null || (int)$entry['row']['resource_id'] !== $resourceId) {
            return ['category' => 'mismatch'];
        }
        if ((int)$entry['row']['offering_id'] !== (int)$item['offering_id']) {
            return ['category' => 'other_offering'];
        }
        return [
            'category' => 'attached',
            'kind' => 'electronic',
            'pointer_id' => $courseResourceId,
            'offering_id' => (int)$entry['row']['offering_id'],
            'snapshot' => $entry['snapshot'],
        ];
    }

    private function classifyPhysical($kind, array $item, $referenceMarker)
    {
        $referenceId = SourceResourceId::canonical($referenceMarker);
        $entry = $referenceId === null ? null : $this->snapshots->physical($referenceId);
        if ($entry === null || (int)$entry['row']['offering_id'] !== (int)$item['offering_id']) {
            return ['category' => 'unresolved'];
        }
        $error = $this->snapshots->physicalError($kind, $item, $entry['row']);
        if ($error !== null) {
            return ['category' => $error === 'destination_ambiguous' ? 'ambiguous' : 'unresolved'];
        }
        return [
            'category' => 'attached',
            'kind' => 'physical',
            'pointer_id' => $referenceId,
            'offering_id' => (int)$entry['row']['offering_id'],
            'snapshot' => $entry['snapshot'],
        ];
    }

    private function hasAttachment($kind, $itemId)
    {
        return (bool)$this->db->createCommand(
            'SELECT 1 FROM publication_attachments WHERE item_kind = :kind AND item_id = :id LIMIT 1',
            [':kind' => $kind, ':id' => $itemId]
        )->queryScalar();
    }

    private function attach($itemKind, $itemId, array $result)
    {
        $pointerColumn = $result['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        $destination = $this->db->createCommand(
            'SELECT id FROM publication_destinations WHERE `' . $pointerColumn . '` = :pointer',
            [':pointer' => $result['pointer_id']]
        )->queryOne();
        if ($destination) {
            $destinationId = (int)$destination['id'];
        } else {
            $this->db->createCommand()->insert('publication_destinations', [
                'destination_kind' => $result['kind'],
                'course_resource_id' => $result['kind'] === 'electronic' ? $result['pointer_id'] : null,
                'physical_reference_id' => $result['kind'] === 'physical' ? $result['pointer_id'] : null,
                'offering_id' => $result['offering_id'],
                'origin_offering_id' => $result['offering_id'],
                'ownership_source' => 'none',
            ])->execute();
            $destinationId = (int)$this->db->getLastInsertID();
        }
        $json = json_encode($result['snapshot'], JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('Could not encode the API-116A destination snapshot.');
        }
        $this->db->createCommand()->insert('publication_attachments', [
            'destination_id' => $destinationId,
            'item_kind' => $itemKind,
            'item_id' => $itemId,
            'attached_snapshot_json' => $json,
            'live' => 1,
        ])->execute();
    }
}

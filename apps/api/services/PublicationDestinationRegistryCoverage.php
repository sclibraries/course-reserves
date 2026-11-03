<?php

namespace app\services;

/** Builds and compares the complete ordered-lock key set for one attempt. */
class PublicationDestinationRegistryCoverage
{
    private const BUCKETS = [
        'offering_ids', 'resource_ids', 'resource_metadata_ids', 'resource_link_ids', 'folder_ids',
        'course_resource_ids', 'physical_reference_ids', 'destination_ids', 'submission_ids',
        'destination_pointers', 'new_item_ids', 'reuse_item_ids', 'publication_state_items', 'attachment_ids',
    ];

    public function fromContext(array $context)
    {
        $coverage = array_fill_keys(self::BUCKETS, []);
        foreach ($context['items'] ?? [] as $item) {
            if ($item) {
                $this->addItem($coverage, $item);
            }
        }
        foreach ($context['destinations'] ?? [] as $row) {
            if ($row) {
                $coverage['destination_ids'][] = (int)$row['id'];
                $this->addIfSet($coverage, 'offering_ids', $row['offering_id'] ?? null);
                $this->addIfSet($coverage, 'course_resource_ids', $row['course_resource_id'] ?? null);
                $this->addIfSet($coverage, 'physical_reference_ids', $row['physical_reference_id'] ?? null);
                $this->addDestinationPointer($coverage, $row);
            }
        }
        foreach ($context['entries'] ?? [] as $entry) {
            if (!$entry) {
                continue;
            }
            $row = $entry['row'];
            $this->addIfSet($coverage, 'offering_ids', $row['offering_id'] ?? null);
            if ($entry['kind'] === 'electronic') {
                $this->addIfSet($coverage, 'course_resource_ids', $row['course_resource_id'] ?? null);
                $this->addIfSet($coverage, 'resource_ids', $row['resource_id'] ?? null);
            } else {
                $this->addIfSet($coverage, 'physical_reference_ids', $row['reference_id'] ?? null);
            }
            foreach ($entry['dependencies'] ?? [] as $bucket => $ids) {
                if (isset($coverage[$bucket])) {
                    $coverage[$bucket] = array_merge($coverage[$bucket], $ids);
                }
            }
        }
        foreach ($context['pointers'] ?? [] as $pointer) {
            if ($pointer) {
                $bucket = $pointer['kind'] === 'electronic' ? 'course_resource_ids' : 'physical_reference_ids';
                $coverage[$bucket][] = (int)$pointer['id'];
                $coverage['destination_pointers'][] = $pointer;
            }
        }
        foreach ($context['attachments'] ?? [] as $attachment) {
            if ($attachment) {
                $coverage['attachment_ids'][] = (int)$attachment['id'];
            }
        }

        foreach ($coverage as $bucket => $ids) {
            if ($bucket === 'publication_state_items' || $bucket === 'destination_pointers') {
                $unique = [];
                foreach ($ids as $item) {
                    $key = $item['kind'] . ':' . (int)$item['id'];
                    $unique[$key] = ['kind' => $item['kind'], 'id' => (int)$item['id']];
                }
                $coverage[$bucket] = array_values($unique);
                usort($coverage[$bucket], function ($a, $b) use ($bucket) {
                    if ($a['kind'] === $b['kind']) {
                        return $a['id'] <=> $b['id'];
                    }
                    if ($bucket === 'destination_pointers') {
                        return $a['kind'] === 'electronic' ? -1 : 1;
                    }
                    return $a['kind'] === 'new' ? -1 : 1;
                });
            } else {
                $coverage[$bucket] = array_values(array_unique(array_map('intval', $ids)));
                sort($coverage[$bucket], SORT_NUMERIC);
            }
        }
        return $coverage;
    }

    public function assertContains(array $coverage, $bucket, $id)
    {
        if (!isset($coverage[$bucket]) || !in_array((int)$id, $coverage[$bucket], true)) {
            throw new PublicationDestinationRestartRequired('A destination key is outside acquired coverage.');
        }
    }

    private function addItem(array &$coverage, array $context)
    {
        $kind = $context['kind'];
        $id = (int)$context['id'];
        $coverage[$kind === 'new' ? 'new_item_ids' : 'reuse_item_ids'][] = $id;
        $coverage['publication_state_items'][] = ['kind' => $kind, 'id' => $id];
        $row = $context['row'] ?? [];
        $this->addIfSet($coverage, 'submission_ids', $row['submission_id'] ?? null);
        $this->addIfSet($coverage, 'offering_ids', $row['offering_id'] ?? null);
        $resourceId = SourceResourceId::canonical($row['source_resource_id'] ?? null);
        $this->addIfSet($coverage, 'resource_ids', $resourceId);
    }

    private function addDestinationPointer(array &$coverage, array $destination)
    {
        if (!empty($destination['course_resource_id'])) {
            $coverage['destination_pointers'][] = [
                'kind' => 'electronic', 'id' => (int)$destination['course_resource_id'],
            ];
        } elseif (!empty($destination['physical_reference_id'])) {
            $coverage['destination_pointers'][] = [
                'kind' => 'physical', 'id' => (int)$destination['physical_reference_id'],
            ];
        }
    }

    private function addIfSet(array &$coverage, $bucket, $value)
    {
        if (is_numeric($value) && (int)$value > 0) {
            $coverage[$bucket][] = (int)$value;
        }
    }
}

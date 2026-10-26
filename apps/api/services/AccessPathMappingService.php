<?php

namespace app\services;

/** Validates and audits the admin mapping for access paths. */
class AccessPathMappingService
{
    use ServiceResult;

    private $mappings;
    private $events;

    public function __construct($mappings = null, $events = null)
    {
        $this->mappings = $mappings ?: new AccessPathMappingRepository();
        $this->events = $events ?: new WorkflowEventLog();
    }

    public function getMapping()
    {
        $rows = [];
        foreach ($this->mappings->all() as $row) {
            $rows[$row['access_path']] = $this->format($row);
        }
        $mapping = [];
        foreach (AccessPathPolicy::PATHS as $path) {
            $mapping[] = $rows[$path] ?? ['access_path' => $path, 'flow_id' => null, 'group_id' => null];
        }
        return ['mapping' => $mapping];
    }

    public function putMapping(array $body, array $actor)
    {
        $rows = $this->normalize($body['mapping'] ?? null);
        if ($rows === null) {
            return $this->result(400, ['error_code' => 'invalid_mapping']);
        }
        $before = $this->getMapping()['mapping'];
        $after = array_map([$this, 'format'], $rows);
        return Transactional::run(function () use ($rows, $before, $after, $actor) {
            $this->mappings->replace($rows);
            $this->events->record(
                null, null, $actor, 'flow_mapping_updated', null,
                ['mapping' => $before], ['mapping' => $after]
            );
            return $this->result(200, ['mapping' => $after]);
        });
    }

    private function normalize($rows)
    {
        if (!is_array($rows)) {
            return null;
        }
        $normalized = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !is_string($row['access_path'] ?? null)) {
                return null;
            }
            $path = $row['access_path'];
            if (!in_array($path, AccessPathPolicy::PATHS, true) || isset($normalized[$path])) {
                return null;
            }
            $flowId = $this->normalizeId($row['flow_id'] ?? null, 'flowExists');
            $groupId = $this->normalizeId($row['group_id'] ?? null, 'groupExists');
            if ($flowId === false || $groupId === false) {
                return null;
            }
            $normalized[$path] = [
                'access_path' => $path,
                'flow_id' => $flowId,
                'group_id' => $groupId,
            ];
        }
        if (count($normalized) !== count(AccessPathPolicy::PATHS)) {
            return null;
        }
        $ordered = [];
        foreach (AccessPathPolicy::PATHS as $path) {
            $ordered[] = $normalized[$path];
        }
        return $ordered;
    }

    private function normalizeId($value, $existsMethod)
    {
        if ($value === null) {
            return null;
        }
        if (!is_int($value) && (!is_string($value) || !ctype_digit($value))) {
            return false;
        }
        $id = (int)$value;
        return $id > 0 && $this->mappings->$existsMethod($id) ? $id : false;
    }

    private function format(array $row)
    {
        return [
            'access_path' => $row['access_path'],
            'flow_id' => $row['flow_id'] === null ? null : (int)$row['flow_id'],
            'group_id' => $row['group_id'] === null ? null : (int)$row['group_id'],
        ];
    }
}

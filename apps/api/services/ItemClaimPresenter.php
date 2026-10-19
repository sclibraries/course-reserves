<?php

namespace app\services;

/** Builds the single staff-only item shape used by claims, queues, and timelines. */
class ItemClaimPresenter
{
    public function present(array $row, $expiryHours)
    {
        $claimedBy = $row['claimed_by'] === null ? null : (string)$row['claimed_by'];
        $lastActivity = $row['last_activity_at'] ?: $row['claimed_at'];
        $expiresAt = $claimedBy !== null && $lastActivity
            ? date('Y-m-d H:i:s', strtotime($lastActivity) + ((int)$expiryHours * 3600))
            : null;
        $assignedGroupId = empty($row['assigned_group_id']) ? null : (int)$row['assigned_group_id'];
        $title = $row['title'] ?? null;
        if (!$title && !empty($row['resource_data'])) {
            $resourceData = json_decode($row['resource_data'], true);
            $title = is_array($resourceData) ? ($resourceData['title'] ?? null) : null;
        }

        return [
            'kind' => $row['item_kind'] ?? $row['kind'],
            'id' => (int)$row['id'],
            'submission_id' => (int)$row['submission_id'],
            'submission_uuid' => $row['submission_uuid'],
            'course_code' => $row['course_code'],
            'section' => $row['section'],
            'term_code' => $row['term_code'],
            'title' => $title ?: ($row['source_resource_title'] ?? null),
            'material_type' => $row['material_type'] ?? null,
            'position' => (int)$row['position'],
            'status' => $row['status'],
            'claimed_by' => $claimedBy,
            'claimed_by_display' => $claimedBy === null ? null : ($row['claimed_by_display'] ?? null),
            'claimed_at' => $row['claimed_at'],
            'last_activity_at' => $row['last_activity_at'],
            'expires_at' => $expiresAt,
            'assigned_group' => $assignedGroupId === null ? null : [
                'id' => $assignedGroupId,
                'name' => $row['assigned_group_name'] ?? null,
            ],
        ];
    }
}

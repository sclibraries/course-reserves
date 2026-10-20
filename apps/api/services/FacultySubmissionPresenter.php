<?php

namespace app\services;

use yii\base\Arrayable;

/**
 * Faculty response allowlists for submissions and their related data.
 */
class FacultySubmissionPresenter
{
    private const SUBMISSION_FIELDS = [
        'submission_uuid', 'term_code', 'course_code', 'section', 'course_title',
        'its_course_id', 'academic_period',
        'folio_course_listing_id', 'offering_id', 'needed_by_date', 'status', 'draft_version',
        'submission_notes', 'faculty_display_name', 'created_at', 'updated_at',
        'submitted_at', 'is_locked', 'locked_at', 'locked_by_staff_id', 'lock_reason',
        'email_confirmation_status', 'email_confirmation_requested_at',
        'email_confirmation_sent_at', 'email_confirmation_sent',
        'id', 'instructors', 'term', 'lastUpdated', 'isTestData', 'item_counts',
        'completion_percentage', 'folders', 'unfoldered_items', 'ungrouped_items',
        'status_summary', 'metadata', 'lock_status', 'can_edit', 'access',
        'proxy_can_edit', 'reuseResources', 'newResources', 'communications',
        'courseOffering',
    ];

    private const RESOURCE_FIELDS = [
        'id', 'material_type_id', 'resource_data', 'is_reuse', 'source_barcode',
        'source_call_number', 'source_resource_id', 'source_folio_instance_id',
        'barcode', 'call_number', 'item_status', 'display_order', 'position_in_folder',
        'folder_name', 'faculty_notes', 'priority', 'created_at', 'updated_at',
    ];

    private const FOLDER_FIELDS = ['id', 'folder_id', 'name', 'display_order', 'item_count'];

    private const FOLDER_ITEM_FIELDS = [
        'type', 'id', 'title', 'authors', 'material_type', 'material_type_id',
        'is_reuse', 'barcode', 'call_number', 'status', 'item_status', 'display_order',
        'position_in_folder', 'folder_name', 'notes', 'faculty_notes', 'priority',
        'created_at', 'updated_at', 'resource_data', 'source_barcode', 'source_call_number',
    ];

    private const METADATA_FIELDS = [
        'total_items', 'total_folders', 'items_in_folders', 'ungrouped_items',
        'created_at', 'updated_at',
    ];

    private const COURSE_OFFERING_FIELDS = [
        'offering_id', 'offering_uuid', 'folio_course_id', 'term_id', 'term_name',
        'section_name', 'start_date', 'end_date', 'status',
    ];

    private const COMMUNICATION_FIELDS = [
        'id', 'parent_message_id', 'resource_id', 'subject', 'message', 'category',
        'priority', 'status', 'sender_type', 'sender_name', 'created_at', 'updated_at',
        'is_read', 'reply_count', 'replies',
    ];

    public static function submissionIndexResponse(array $response)
    {
        $items = [];
        foreach ($response['items'] ?? [] as $item) {
            $items[] = self::submissionResponse($item);
        }

        $result = ['items' => $items];
        if (isset($response['meta']) && is_array($response['meta'])) {
            $result['meta'] = self::pick($response['meta'], [
                'totalCount', 'count', 'page', 'perPage', 'sortBy', 'sortOrder',
            ]);
        }
        return $result;
    }

    public static function submissionResponse($submission)
    {
        $submission = self::arrayValue($submission);
        if (!is_array($submission)) {
            return $submission;
        }

        $result = [];
        foreach ($submission as $field => $value) {
            if (!in_array($field, self::SUBMISSION_FIELDS, true)) {
                continue;
            }
            if ($field === 'reuseResources' || $field === 'newResources') {
                $value = self::resourceCollection($value);
            } elseif ($field === 'folders') {
                $value = self::folderCollection($value);
            } elseif ($field === 'unfoldered_items' || $field === 'ungrouped_items') {
                $value = self::folderItemCollection($value);
            } elseif ($field === 'metadata') {
                $value = self::metadata($value);
            } elseif ($field === 'courseOffering') {
                $value = self::courseOffering($value);
            } elseif ($field === 'communications') {
                $value = self::communicationCollection($value);
            } elseif ($field === 'status_summary') {
                $value = self::statusSummary($value);
            } elseif ($field === 'item_counts') {
                $value = self::pick(self::arrayValue($value), ['total', 'reuse', 'new', 'complete', 'pending']);
            } elseif ($field === 'lock_status') {
                $value = self::pick(self::arrayValue($value), [
                    'is_locked', 'locked_at', 'locked_by', 'lock_reason', 'can_edit',
                ]);
            }
            $result[$field] = $value;
        }
        return $result;
    }

    public static function statusResponse(array $response)
    {
        $result = self::pick($response, [
            'course_code', 'course_title', 'term_code', 'overall_status', 'submitted_at',
            'last_updated',
        ]);
        if (array_key_exists('status_summary', $response)) {
            $result['status_summary'] = self::statusSummary($response['status_summary']);
        }
        return $result;
    }

    public static function submitCompleteResponse(array $response)
    {
        $result = self::pick($response, ['success', 'message']);
        if (array_key_exists('submission', $response)) {
            $result['submission'] = self::submissionResponse($response['submission']);
        }
        if (isset($response['stats']) && is_array($response['stats'])) {
            $result['stats'] = self::pick($response['stats'], [
                'resources_processed', 'folders_created', 'reuse_items', 'new_items',
            ]);
        }
        return $result;
    }

    public static function resourceResponse($resource)
    {
        return self::pick(self::arrayValue($resource), self::RESOURCE_FIELDS);
    }

    public static function facultyCommunicationsResponse(array $response)
    {
        if (!array_key_exists('messages', $response)) {
            return [];
        }
        return ['messages' => self::communicationCollection($response['messages'])];
    }

    private static function resourceCollection($resources)
    {
        return self::mapRows($resources, [self::class, 'resourceResponse']);
    }

    private static function folderCollection($folders)
    {
        return self::mapRows($folders, function ($folder) {
            $folder = self::arrayValue($folder);
            $result = self::pick($folder, self::FOLDER_FIELDS);
            if (is_array($folder) && array_key_exists('items', $folder)) {
                $result['items'] = self::folderItemCollection($folder['items']);
            }
            return $result;
        });
    }

    private static function folderItemCollection($items)
    {
        return self::mapRows($items, function ($item) {
            return self::pick(self::arrayValue($item), self::FOLDER_ITEM_FIELDS);
        });
    }

    private static function metadata($metadata)
    {
        return self::pick(self::arrayValue($metadata), self::METADATA_FIELDS);
    }

    private static function courseOffering($courseOffering)
    {
        return self::pick(self::arrayValue($courseOffering), self::COURSE_OFFERING_FIELDS);
    }

    private static function communicationCollection($messages)
    {
        return self::mapRows($messages, function ($message) {
            $message = self::arrayValue($message);
            $result = self::pick($message, self::COMMUNICATION_FIELDS);
            if (is_array($message) && array_key_exists('replies', $message)) {
                $result['replies'] = self::communicationCollection($message['replies']);
            }
            return $result;
        });
    }

    private static function statusSummary($summary)
    {
        $summary = self::arrayValue($summary);
        $result = self::pick($summary, ['total_items', 'completion_percentage']);
        if (is_array($summary) && isset($summary['by_status']) && is_array($summary['by_status'])) {
            $result['by_status'] = $summary['by_status'];
        }
        return $result;
    }

    private static function mapRows($rows, $callback)
    {
        if (!is_array($rows)) {
            return $rows;
        }
        $result = [];
        foreach ($rows as $key => $row) {
            $result[$key] = call_user_func($callback, $row);
        }
        return $result;
    }

    private static function pick($value, array $fields)
    {
        $value = self::arrayValue($value);
        if (!is_array($value)) {
            return $value;
        }
        $result = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $value)) {
                $result[$field] = $value[$field];
            }
        }
        return $result;
    }

    private static function arrayValue($value)
    {
        return $value instanceof Arrayable ? $value->toArray() : $value;
    }
}

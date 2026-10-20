<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use app\models\MaterialTypes;
use app\models\SubmissionFolder;
use app\models\SubmissionMetadata;
use app\models\SubmissionNewResource;

/** Persists the shared course, folder, item and metadata payload. */
class SubmissionPayloadService
{
    const RESOURCE_FIELDS = ['title', 'authors', 'publisher', 'publicationYear', 'materialType', 'isbn', 'notes', 'url'];

    public function validationResources(array $resources)
    {
        $result = [];
        foreach ($resources as $item) {
            if (isset($item['resource_data'])) {
                $result[] = $item;
                continue;
            }
            $result[] = ['resource_data' => $this->resourceData($item)];
        }
        return $result;
    }

    public function validate(array $course, array $resources)
    {
        foreach (['courseCode', 'courseTitle', 'term'] as $field) {
            if (!isset($course[$field]) || trim((string)$course[$field]) === '') {
                throw new \yii\web\BadRequestHttpException('Missing required course information: ' . $field);
            }
        }

        foreach ($resources as $index => $resource) {
            $resourceData = $resource['resource_data'] ?? [];
            if (!is_array($resourceData) || empty($resourceData['title'])) {
                throw new \yii\web\BadRequestHttpException('Resource ' . $index . ' is missing required title');
            }
            if (!empty($resourceData['url']) && !filter_var(trim($resourceData['url']), FILTER_VALIDATE_URL)) {
                throw new \yii\web\BadRequestHttpException('Resource ' . $index . ' has an invalid URL');
            }
        }
    }

    public function replace($submissionId, array $payload, array $actor)
    {
        $resources = $this->resourcesFromPayload($payload);
        $folders = $this->foldersFromPayload($payload);
        $metadata = $payload['metadata'] ?? [];
        $displayOrder = $payload['displayOrder'] ?? [];

        $this->deletePayload($submissionId);

        $folderNames = [];
        foreach ($folders as $folder) {
            $id = $folder['id'];
            $name = $folder['title'];
            $position = $this->displayPosition($displayOrder, $id, $folder['display_order'] ?? 999);
            $row = new SubmissionFolder();
            $row->submission_id = $submissionId;
            $row->folder_name = $name;
            $row->display_order = $position;
            if (!$row->save()) {
                throw new \RuntimeException('Failed to save folder: ' . json_encode($row->errors));
            }
            if ($id !== null) {
                $folderNames[$id] = $name;
                $folderNames[str_replace('folder-', '', $id)] = $name;
            }
        }

        foreach ($resources as $index => $resource) {
            $data = $resource['resource_data'] ?? [];
            $folderId = $resource['folder_id'] ?? $resource['folder_uuid'] ?? null;
            $folderName = $resource['folder_name'] ?? ($folderNames[$folderId] ?? null);
            $materialType = $data['materialType'] ?? 'book';
            $isReuse = !empty($resource['is_reuse']);
            $item = new SubmissionNewResource();
            $item->submission_id = $submissionId;
            $item->material_type_id = $this->materialTypeId($materialType);
            $item->resource_data = json_encode($data);
            $item->is_reuse = $isReuse ? 1 : 0;
            $source = $isReuse ? $resource : [];
            $item->source_barcode = $source['source_barcode'] ?? null;
            $item->source_call_number = $source['source_call_number'] ?? null;
            $item->source_resource_id = $source['source_resource_id'] ?? null;
            $item->source_folio_instance_id = $source['source_folio_instance_id'] ?? null;
            $item->display_order = $resource['display_order'] ?? $index;
            $item->folder_name = $folderName;
            $item->position_in_folder = $resource['position_in_folder'] ?? null;
            $item->faculty_notes = $resource['faculty_notes'] ?? null;
            $item->priority = $resource['priority'] ?? 'medium';
            $item->item_status = 'pending';
            if (!$item->save()) {
                throw new \RuntimeException('Failed to save resource: ' . json_encode($item->errors));
            }
        }

        $this->saveMetadata($submissionId, $metadata, $payload, $actor, count($resources), count($folders));
    }

    public function rawPayload($submissionId)
    {
        $metadata = SubmissionMetadata::find()->where(['submission_id' => $submissionId])->one();
        if (!$metadata || empty($metadata->raw_payload)) {
            return [];
        }
        return json_decode($metadata->raw_payload, true) ?: [];
    }

    public function deletePayload($submissionId, $includeMetadata = false)
    {
        $tables = ['submission_new_resources', 'submission_reuse_resources', 'submission_folders'];
        if ($includeMetadata) {
            array_unshift($tables, 'submission_metadata');
        }
        foreach ($tables as $table) {
            Yii::$app->db->createCommand()->delete($table, ['submission_id' => $submissionId])->execute();
        }
    }

    public function submissionStats(array $payload)
    {
        $resources = $payload['resources'] ?? $payload['items'] ?? [];
        return [
            'resources_processed' => count($resources),
            'folders_created' => count($payload['folders'] ?? []),
            'reuse_items' => ($payload['metadata'] ?? [])['reuseItems'] ?? 0,
            'new_items' => ($payload['metadata'] ?? [])['newItems'] ?? 0,
        ];
    }

    private function resourcesFromPayload(array $payload)
    {
        if (isset($payload['resources']) && is_array($payload['resources'])) {
            return $payload['resources'];
        }

        $resources = [];
        foreach ($payload['items'] ?? [] as $item) {
            $data = $item['resource_data'] ?? $this->resourceData($item);
            $resources[] = [
                'resource_data' => $data,
                'is_reuse' => !empty($item['barcode']),
                'source_barcode' => $item['barcode'] ?? null,
                'source_call_number' => $item['call_number'] ?? null,
                'source_resource_id' => $item['source_resource_id'] ?? null,
                'display_order' => $item['display_order'] ?? count($resources),
                'folder_name' => $item['folder_name'] ?? null,
                'folder_id' => $item['folder_uuid'] ?? null,
                'faculty_notes' => $item['faculty_notes'] ?? $item['notes'] ?? null,
                'priority' => $item['priority'] ?? 'medium',
            ];
        }
        return $resources;
    }

    private function foldersFromPayload(array $payload)
    {
        $folders = $payload['folders'] ?? [];
        foreach ($folders as &$folder) {
            if (!isset($folder['id'])) {
                $folder['id'] = $folder['folder_uuid'] ?? $folder['folder_id'] ?? null;
            }
            if (!isset($folder['title'])) {
                $folder['title'] = $folder['folder_name'] ?? $folder['name'] ?? 'Untitled Folder';
            }
        }
        unset($folder);
        return $folders;
    }

    private function displayPosition(array $displayOrder, $id, $fallback)
    {
        foreach ($displayOrder as $entry) {
            if (isset($entry['id']) && (string)$entry['id'] === (string)$id) {
                return $entry['displayPosition'] ?? $fallback;
            }
        }
        return $fallback;
    }

    private function resourceData(array $item)
    {
        return array_intersect_key($item, array_flip(self::RESOURCE_FIELDS));
    }

    private function materialTypeId($name)
    {
        static $cache = [];
        if (isset($cache[$name])) {
            return $cache[$name];
        }
        $type = MaterialTypes::find()->where(['name' => $name])->one();
        if (!$type) {
            $type = MaterialTypes::find()->where(['name' => 'book'])->one();
        }
        $cache[$name] = $type ? $type->material_type_id : null;
        return $cache[$name];
    }

    private function saveMetadata($submissionId, array $metadata, array $payload, array $actor, $items, $folders)
    {
        $row = SubmissionMetadata::find()->where(['submission_id' => $submissionId])->one();
        if (!$row) {
            $row = new SubmissionMetadata();
            $row->submission_id = $submissionId;
        }
        $row->total_items = $metadata['totalItems'] ?? $items;
        $row->total_folders = $metadata['totalFolders'] ?? $folders;
        $row->items_in_folders = $metadata['itemsInFolders'] ?? 0;
        $row->ungrouped_items = $metadata['ungroupedItems'] ?? $items;
        $row->submitted_by_user_id = $actor['user_id'];
        $row->submitted_by_username = $actor['user_id'];
        $row->submitted_by_full_name = $actor['display_name'] ?? null;
        $row->submitted_by_email = $actor['email'] ?? null;
        $row->submitted_by_institution = $actor['institution'] ?? null;
        $row->raw_payload = json_encode($payload);
        if (!$row->save()) {
            throw new \RuntimeException('Failed to save submission metadata: ' . json_encode($row->errors));
        }
    }
}

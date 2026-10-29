<?php

namespace app\services;

use Yii;
use app\models\CourseResources;
use app\models\FacultySubmission;
use app\models\PhysicalResourceReferences;
use app\models\ResourceLinks;
use app\models\ResourceMetadata;
use app\models\Resources;
use app\models\SubmissionFolder;
use app\models\SubmissionNewResource;
use yii\web\BadRequestHttpException;
use yii\web\ServerErrorHttpException;

class SubmissionItemMaterializationService
{
    public function isPhysicalItem($item)
    {
        return $this->hasValue($item->source_barcode) || $this->hasValue($item->source_folio_instance_id);
    }

    public function getFinalDisplayOrder($item)
    {
        if ($item->display_order !== null && $item->display_order !== '') {
            return (int)$item->display_order;
        }

        if ($item->position_in_folder !== null && $item->position_in_folder !== '') {
            return (int)$item->position_in_folder;
        }

        return 999;
    }

    public function getVisibilitySettings($item)
    {
        $data = $this->getResourceData($item);
        $start = $this->firstDateValue($data, ['displayStartDate', 'startVisibility', 'start_visibility']);
        $end = $this->firstDateValue($data, ['displayEndDate', 'endVisibility', 'end_visibility']);

        return [
            'start_visibility' => $start,
            'end_visibility' => $end,
            'use_resource_visibility' => ($start !== null || $end !== null) ? 1 : 0,
        ];
    }

    public function completeProcessing(SubmissionNewResource $item, $staffId, array $payload = [])
    {
        $submission = $item->submission;
        if (!$submission) {
            throw new BadRequestHttpException('Submission item is missing its parent submission.');
        }
        $this->assertSubmissionIsLinked($submission);

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $scaffoldService = new SubmissionCourseScaffoldService();
            $scaffoldService->ensureSubmissionCourseScaffold($submission);

            if (self::isMaterialized($item)) {
                $this->markItemComplete($item, $staffId, $payload);
                $transaction->commit();
                return $this->buildResult($item);
            }

            $folderId = $this->getCourseFolderIdForItem($item);

            if ($this->isPhysicalItem($item)) {
                $reference = $this->materializePhysicalReference($item, $submission, $folderId);
                $item->materialized_physical_reference_id = $reference->reference_id;
                $item->materialized_folder_id = $folderId;
            } else {
                $resource = $this->resolveElectronicResource($item, $folderId);
                $courseResource = $this->linkElectronicResourceToCourse($item, $submission, $resource, $folderId);

                $item->materialized_resource_id = $resource->resource_id;
                $item->materialized_course_resource_id = $courseResource->course_resource_id;
                $item->materialized_folder_id = $folderId;
            }

            $this->markItemComplete($item, $staffId, $payload);

            if (!$item->save()) {
                throw new ServerErrorHttpException('Failed to update submission item materialization state: ' . json_encode($item->getErrors()));
            }

            $transaction->commit();
            return $this->buildResult($item);
        } catch (\Throwable $e) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $e;
        }
    }

    private function assertSubmissionIsLinked(FacultySubmission $submission)
    {
        if (empty($submission->offering_id) || empty($submission->folio_course_listing_id)) {
            throw new BadRequestHttpException('Submission must be linked to a FOLIO course before item processing can be completed.');
        }
    }

    private function materializePhysicalReference(SubmissionNewResource $item, FacultySubmission $submission, $folderId)
    {
        $externalId = $this->hasValue($item->source_barcode)
            ? trim((string)$item->source_barcode)
            : trim((string)$item->source_folio_instance_id);

        $reference = PhysicalResourceReferences::findOne([
            'external_resource_id' => $externalId,
            'offering_id' => $submission->offering_id,
        ]);

        if (!$reference) {
            $reference = new PhysicalResourceReferences();
            $reference->external_resource_id = $externalId;
            $reference->offering_id = $submission->offering_id;
        }

        $reference->resource_type = 'physical';
        $reference->display_name = $this->getTitle($item);
        $reference->order = $this->getFinalDisplayOrder($item);
        $reference->folder_id = $folderId;

        if (!$reference->save()) {
            throw new ServerErrorHttpException('Failed to materialize physical resource reference: ' . json_encode($reference->getErrors()));
        }

        return $reference;
    }

    private function resolveElectronicResource(SubmissionNewResource $item, $folderId)
    {
        if ($this->hasValue($item->source_resource_id) && is_numeric($item->source_resource_id)) {
            $resource = Resources::findOne((int)$item->source_resource_id);
            if (!$resource) {
                throw new BadRequestHttpException('Source resource was not found.');
            }
            return $resource;
        }

        $data = $this->getResourceData($item);
        $publicText = $this->safePublicText($item);
        $visibility = $this->getVisibilitySettings($item);

        $resource = new Resources();
        $resource->name = $this->getTitle($item);
        $resource->item_url = $this->firstStringValue($data, ['url', 'link', 'item_url']);
        $resource->description = $publicText['description'];
        $resource->external_note = $publicText['external_note'];
        $resource->material_type_id = $item->material_type_id;
        $resource->folder_id = $folderId;
        $resource->start_visibility = $visibility['start_visibility'];
        $resource->end_visibility = $visibility['end_visibility'];
        $resource->use_proxy = !empty($data['useProxy']) || !empty($data['use_proxy']) ? 1 : 0;

        if (!$resource->save()) {
            throw new ServerErrorHttpException('Failed to create electronic resource: ' . json_encode($resource->getErrors()));
        }

        $this->saveResourceLinks($resource, $data);
        $this->saveResourceMetadata($resource, $data);

        return $resource;
    }

    /** Returns only text safe for course-facing resource fields. */
    public function safePublicText(SubmissionNewResource $item)
    {
        $data = $this->getResourceData($item);
        return [
            'description' => $this->firstStringValue($data, ['description', 'abstract']),
            'external_note' => null,
        ];
    }

    private function linkElectronicResourceToCourse(SubmissionNewResource $item, FacultySubmission $submission, Resources $resource, $folderId)
    {
        $courseResource = CourseResources::findOne([
            'offering_id' => $submission->offering_id,
            'resource_id' => $resource->resource_id,
        ]);

        if (!$courseResource) {
            $courseResource = new CourseResources();
            $courseResource->offering_id = $submission->offering_id;
            $courseResource->resource_id = $resource->resource_id;
        }

        $visibility = $this->getVisibilitySettings($item);
        $courseResource->order = $this->getFinalDisplayOrder($item);
        $courseResource->folder_id = $folderId;
        $courseResource->start_visibility = $visibility['start_visibility'];
        $courseResource->end_visibility = $visibility['end_visibility'];
        $courseResource->use_resource_visibility = $visibility['use_resource_visibility'];

        if (!$courseResource->save()) {
            throw new ServerErrorHttpException('Failed to link resource to course: ' . json_encode($courseResource->getErrors()));
        }

        return $courseResource;
    }

    private function getCourseFolderIdForItem(SubmissionNewResource $item)
    {
        if (!$this->hasValue($item->folder_name)) {
            return null;
        }

        $submissionFolder = SubmissionFolder::findOne([
            'submission_id' => $item->submission_id,
            'folder_name' => $item->folder_name,
        ]);

        if (!$submissionFolder || empty($submissionFolder->course_folder_id)) {
            return null;
        }

        return (int)$submissionFolder->course_folder_id;
    }

    private function markItemComplete(SubmissionNewResource $item, $staffId, array $payload)
    {
        if (isset($payload['staff_notes']) && trim((string)$payload['staff_notes']) !== '') {
            $note = trim((string)$payload['staff_notes']);
            $item->staff_notes = trim((string)$item->staff_notes) === ''
                ? $note
                : $item->staff_notes . "\n" . $note;
        }

        $item->item_status = 'complete';
        $item->materialized_at = date('Y-m-d H:i:s');
        $item->materialized_by_staff_id = (string)$staffId;

        if (!$item->save()) {
            throw new ServerErrorHttpException('Failed to mark submission item complete: ' . json_encode($item->getErrors()));
        }
    }

    public static function isMaterialized($item)
    {
        foreach ([
            'materialized_resource_id',
            'materialized_course_resource_id',
            'materialized_physical_reference_id',
            'materialized_folder_id',
            'materialized_by_staff_id',
            'materialized_at',
        ] as $field) {
            if (is_array($item)) {
                $value = $item[$field] ?? null;
            } else {
                $value = is_object($item) && isset($item->$field) ? $item->$field : null;
            }

            if ($value !== null) {
                return true;
            }
        }

        return false;
    }

    private function saveResourceLinks(Resources $resource, array $data)
    {
        if (empty($data['links']) || !is_array($data['links'])) {
            return;
        }

        foreach ($data['links'] as $index => $linkData) {
            if (empty($linkData['url'])) {
                continue;
            }

            $link = new ResourceLinks();
            $link->resource_id = $resource->resource_id;
            $link->url = $linkData['url'];
            $link->title = isset($linkData['title']) ? $linkData['title'] : null;
            $link->description = isset($linkData['description']) ? $linkData['description'] : null;
            $link->use_proxy = !empty($linkData['use_proxy']) || !empty($linkData['useProxy']) ? 1 : 0;
            $link->order = $index + 1;

            if (!$link->save()) {
                throw new ServerErrorHttpException('Failed to save resource link: ' . json_encode($link->getErrors()));
            }
        }
    }

    private function saveResourceMetadata(Resources $resource, array $data)
    {
        if (empty($data['metadata']) || !is_array($data['metadata'])) {
            return;
        }

        foreach ($data['metadata'] as $fieldName => $fieldValue) {
            if ($fieldValue === null || (is_string($fieldValue) && trim($fieldValue) === '')) {
                continue;
            }

            $metadata = new ResourceMetadata();
            $metadata->resource_id = $resource->resource_id;
            $metadata->field_name = (string)$fieldName;
            $metadata->field_value = is_scalar($fieldValue) ? (string)$fieldValue : json_encode($fieldValue);

            if (!$metadata->save()) {
                throw new ServerErrorHttpException('Failed to save resource metadata: ' . json_encode($metadata->getErrors()));
            }
        }
    }

    private function buildResult(SubmissionNewResource $item)
    {
        return [
            'materialized_resource_id' => $item->materialized_resource_id ? (int)$item->materialized_resource_id : null,
            'materialized_course_resource_id' => $item->materialized_course_resource_id ? (int)$item->materialized_course_resource_id : null,
            'materialized_physical_reference_id' => $item->materialized_physical_reference_id ? (int)$item->materialized_physical_reference_id : null,
            'materialized_folder_id' => $item->materialized_folder_id ? (int)$item->materialized_folder_id : null,
            'materialized_at' => $item->materialized_at,
            'materialized_by_staff_id' => $item->materialized_by_staff_id,
        ];
    }

    private function getResourceData($item)
    {
        $data = json_decode($item->resource_data, true);
        return is_array($data) ? $data : [];
    }

    private function getTitle($item)
    {
        $data = $this->getResourceData($item);
        $title = $this->firstStringValue($data, ['title', 'name']);
        return $title !== null ? $title : 'Untitled';
    }

    private function firstDateValue(array $data, array $keys)
    {
        $value = $this->firstStringValue($data, $keys);
        if ($value === null) {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value, $matches)) {
            return $matches[0];
        }

        return null;
    }

    private function firstStringValue(array $data, array $keys)
    {
        foreach ($keys as $key) {
            if (isset($data[$key]) && trim((string)$data[$key]) !== '') {
                return trim((string)$data[$key]);
            }
        }

        return null;
    }

    private function hasValue($value)
    {
        return $value !== null && trim((string)$value) !== '';
    }
}

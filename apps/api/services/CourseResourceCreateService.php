<?php

namespace app\services;

use app\models\CourseOfferings;
use app\models\CourseResources;
use app\models\Courses;
use app\models\ResourceLinks;
use app\models\ResourceMetadata;
use app\models\Resources;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use yii\web\ServerErrorHttpException;

/** Creates a resource with its links, metadata and offering link; the whole operation is one retrying owner. */
class CourseResourceCreateService
{
    public function create($courseId, $folioData, $body)
    {
        [$resource, $offeringId] = Transactional::retrying(function () use ($courseId, $folioData, $body) {
            $offering = $this->findOffering($courseId, $folioData, $body);
            if (!($body['title'] ?? null)) {
                throw new BadRequestHttpException('Resource "title" is required.');
            }

            $resource = new Resources();
            $resource->name = $body['title'];
            $resource->item_url = $body['link'] ?? null;
            $resource->description = $body['notes'] ?? null;
            $resource->material_type_id = $body['material_type_id'] ?? null;
            $resource->internal_note = $body['internal_note'] ?? null;
            $resource->external_note = $body['external_note'] ?? null;
            $resource->start_visibility = $body['start_visibility'] ?? null;
            $resource->end_visibility = $body['end_visibility'] ?? null;
            $resource->use_proxy = (int)($body['use_proxy'] ?? 0);
            $resource->folder_id = $body['folder'] ?? null;
            $this->saveOrFail($resource, 'Failed to create resource: ');

            $links = $body['links'] ?? [];
            if (!empty($links) && is_array($links)) {
                (new ResourceMutationService())->replaceLinks($resource->resource_id, $links);
            }
            $this->saveMetadata($resource->resource_id, $body['metadata'] ?? []);

            $courseResource = new CourseResources();
            $courseResource->offering_id = $offering->offering_id;
            $courseResource->resource_id = $resource->resource_id;
            $courseResource->start_visibility = $resource->start_visibility;
            $courseResource->end_visibility = $resource->end_visibility;
            $courseResource->use_resource_visibility = (int)($body['use_resource_visibility'] ?? 0);
            $courseResource->primary_link_start_visibility = $body['primary_link_start_visibility'] ?? null;
            $courseResource->primary_link_end_visibility = $body['primary_link_end_visibility'] ?? null;
            $courseResource->use_primary_link_visibility = (int)($body['use_primary_link_visibility'] ?? 0);
            $this->saveOrFail($courseResource, 'Failed to link resource: ');

            return [$resource, $offering->offering_id];
        });

        return [
            'resource' => $resource,
            'course_offering' => $offeringId,
            'links' => ResourceLinks::findAll(['resource_id' => $resource->resource_id]),
            'metadata' => ResourceMetadata::findAll(['resource_id' => $resource->resource_id]),
            'success' => true,
        ];
    }

    /** Uses the exact offering selected in the form: course and term alone are ambiguous across sections. */
    private function findOffering($courseId, $folioData, $body)
    {
        if (!Courses::findOne($courseId)) {
            throw new NotFoundHttpException('Course not found.');
        }
        $offeringId = filter_var($body['offering_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($offeringId === false) {
            throw new BadRequestHttpException('A valid "offering_id" is required.');
        }
        $offering = CourseOfferings::findOne($offeringId);
        if (!$offering) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        if ((int)$offering->course_id !== (int)$courseId) {
            throw new BadRequestHttpException('The selected offering does not belong to this course.');
        }
        $folioCourseId = $folioData['courseListingId'] ?? null;
        if (!$folioCourseId) {
            throw new BadRequestHttpException('A FOLIO course listing is required.');
        }
        if ((string)$offering->folio_course_id !== (string)$folioCourseId) {
            throw new BadRequestHttpException('The selected offering does not match the FOLIO course listing.');
        }
        return $offering;
    }

    private function saveMetadata($resourceId, $metadata)
    {
        foreach (is_array($metadata) ? $metadata : [] as $fieldName => $fieldValue) {
            if (is_string($fieldValue) && trim($fieldValue) === '') {
                continue;
            }
            $row = new ResourceMetadata();
            $row->resource_id = $resourceId;
            $row->field_name = $fieldName;
            $row->field_value = $fieldValue;
            $this->saveOrFail($row, 'Failed to save metadata: ');
        }
    }

    private function saveOrFail($model, $message)
    {
        if (!$model->save()) {
            throw new ServerErrorHttpException($message . json_encode($model->getErrors()));
        }
    }
}

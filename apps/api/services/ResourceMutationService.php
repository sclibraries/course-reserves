<?php

namespace app\services;

use Yii;
use app\models\CourseResources;
use app\models\ResourceLinks;
use app\models\ResourceMetadata;
use app\models\Resources;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;

/** Applies resource and child-row edits atomically, then invalidates dependent drafts once. */
class ResourceMutationService
{
    private const SOURCE_FIELDS = [
        'name', 'item_url', 'description', 'material_type_id', 'start_visibility', 'end_visibility', 'use_proxy',
        'use_primary_link_visibility', 'primary_link_start_visibility', 'primary_link_end_visibility',
    ];

    private $invalidator;

    public function __construct($invalidator = null)
    {
        $this->invalidator = $invalidator ?: new SubmissionPublicationInvalidator();
    }

    public function update($id, array $data, $publishingItem = null)
    {
        return Transactional::run(function () use ($id, $data, $publishingItem) {
            $this->lockResource($id);
            $resource = Resources::findOne($id);
            if (!$resource) {
                throw new NotFoundHttpException('Resource not found');
            }
            $before = $this->fingerprint($id);
            $metadataData = $data['metadata'] ?? [];
            $linksData = $data['links'] ?? [];
            if (!is_array($metadataData) || !is_array($linksData)) {
                throw new BadRequestHttpException('Metadata and links must be arrays.');
            }
            $visibilityData = $this->visibilityData($data);
            $courseResourceId = $data['course_resource_id'] ?? null;
            unset(
                $data['metadata'], $data['links'], $data['course_resource_id'], $data['start_visibility'],
                $data['end_visibility'], $data['use_resource_visibility'], $data['primary_link_start_visibility'],
                $data['primary_link_end_visibility'], $data['use_primary_link_visibility']
            );
            $this->normalizeResourceFields($data);

            $resource->suppressSourceInvalidation = true;
            $resource->attributes = $data;
            $saved = $resource->save();
            $resource->suppressSourceInvalidation = false;
            if (!$saved) {
                throw new BadRequestHttpException('Failed to save resource: ' . json_encode($resource->errors));
            }
            $this->saveVisibility($id, $courseResourceId, $visibilityData);
            $this->saveMetadata($id, $metadataData);
            $this->replaceLinks($id, $linksData);
            if ($before !== $this->fingerprint($id)) {
                $this->invalidator->sourceResource($id, $publishingItem);
            }

            return [
                'resource' => $resource,
                'links' => ResourceLinks::find()->where(['resource_id' => $id])->orderBy(['order' => SORT_ASC])->all(),
                'metadata' => ResourceMetadata::findAll(['resource_id' => $id]),
            ];
        });
    }

    public function addLink($resourceId, array $data)
    {
        return Transactional::run(function () use ($resourceId, $data) {
            $this->lockResource($resourceId);
            if (!Resources::findOne($resourceId)) {
                throw new NotFoundHttpException('Resource not found');
            }
            $link = new ResourceLinks();
            $link->load($data, '');
            $link->resource_id = $resourceId;
            if (!$link->order) {
                $lastLink = ResourceLinks::find()->where(['resource_id' => $resourceId])
                    ->orderBy(['order' => SORT_DESC])->one();
                $link->order = $lastLink ? $lastLink->order + 1 : 1;
            }
            if ($link->save()) {
                $this->invalidator->sourceResource($resourceId);
                return $link;
            }
            return $link->errors;
        });
    }

    public function deleteLink($id)
    {
        return Transactional::run(function () use ($id) {
            $link = ResourceLinks::findOne($id);
            if (!$link) {
                throw new NotFoundHttpException('Link not found');
            }
            $resourceId = (int)$link->resource_id;
            $this->lockResource($resourceId);
            $link = ResourceLinks::findOne($id);
            if (!$link) {
                throw new NotFoundHttpException('Link not found');
            }
            if ($link->delete()) {
                $this->invalidator->sourceResource($resourceId);
            }
            return ['success' => true];
        });
    }

    private function lockResource($resourceId)
    {
        Yii::$app->db->createCommand(
            'SELECT resource_id FROM resources WHERE resource_id = :id FOR UPDATE',
            [':id' => (int)$resourceId]
        )->queryScalar();
    }

    private function visibilityData(array $data)
    {
        $visibility = [];
        foreach (['start_visibility', 'end_visibility', 'primary_link_start_visibility', 'primary_link_end_visibility'] as $field) {
            if (array_key_exists($field, $data)) {
                $visibility[$field] = $data[$field] === '' ? null : $data[$field];
            }
        }
        foreach (['use_resource_visibility', 'use_primary_link_visibility'] as $field) {
            if (isset($data[$field])) {
                $visibility[$field] = $data[$field] ? 1 : 0;
            }
        }
        return $visibility;
    }

    private function normalizeResourceFields(array &$data)
    {
        foreach (['folder' => 'folder_id', 'title' => 'name', 'link' => 'item_url', 'notes' => 'description'] as $from => $to) {
            if (isset($data[$from])) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }
        if (isset($data['use_proxy'])) {
            $data['use_proxy'] = $data['use_proxy'] ? 1 : 0;
        }
    }

    private function saveVisibility($resourceId, $courseResourceId, array $visibility)
    {
        if (!$visibility) {
            return;
        }
        $courseResources = $courseResourceId
            ? array_filter([CourseResources::findOne($courseResourceId)])
            : CourseResources::findAll(['resource_id' => $resourceId]);
        foreach ($courseResources as $courseResource) {
            $courseResource->attributes = $visibility;
            if (!$courseResource->save()) {
                throw new BadRequestHttpException(
                    'Failed to save course-resource visibility: ' . json_encode($courseResource->errors)
                );
            }
        }
    }

    private function saveMetadata($resourceId, array $metadata)
    {
        foreach ($metadata as $field => $value) {
            $meta = ResourceMetadata::find()->where(['resource_id' => $resourceId, 'field_name' => $field])->one();
            if (!$meta) {
                $meta = new ResourceMetadata();
                $meta->resource_id = $resourceId;
                $meta->field_name = $field;
            }
            $meta->field_value = $value;
            if (!$meta->save()) {
                throw new BadRequestHttpException('Failed to save metadata: ' . json_encode($meta->errors));
            }
        }
    }

    public function replaceLinks($resourceId, array $links)
    {
        $desired = [];
        foreach ($links as $index => $data) {
            if (!is_array($data)) {
                throw new BadRequestHttpException('Each resource link must be an object.');
            }
            if (empty($data['url'])) {
                continue;
            }
            $desired[] = [
                'url' => $data['url'],
                'title' => $data['title'] ?? null,
                'description' => $data['description'] ?? null,
                'use_proxy' => !empty($data['use_proxy']) ? 1 : 0,
                'order' => $index + 1,
                'use_link_visibility' => !empty($data['use_link_visibility']) ? 1 : 0,
                'start_visibility' => !empty($data['start_visibility']) ? $data['start_visibility'] : null,
                'end_visibility' => !empty($data['end_visibility']) ? $data['end_visibility'] : null,
            ];
        }
        if ($desired === $this->links($resourceId)) {
            return;
        }
        ResourceLinks::deleteAll(['resource_id' => $resourceId]);
        foreach ($desired as $values) {
            $link = new ResourceLinks();
            $link->setAttributes(array_merge(['resource_id' => $resourceId], $values), false);
            if (!$link->save()) {
                throw new BadRequestHttpException('Failed to save link: ' . json_encode($link->errors));
            }
        }
    }

    private function fingerprint($resourceId)
    {
        $fields = implode(', ', self::SOURCE_FIELDS);
        $resource = Yii::$app->db->createCommand(
            'SELECT ' . $fields . ' FROM resources WHERE resource_id = :id', [':id' => (int)$resourceId]
        )->queryOne();
        $metadata = Yii::$app->db->createCommand(
            'SELECT field_name, field_value FROM resource_metadata WHERE resource_id = :id '
            . 'ORDER BY field_name, field_value', [':id' => (int)$resourceId]
        )->queryAll();
        return ['resource' => $resource, 'metadata' => $metadata, 'links' => $this->links($resourceId)];
    }

    private function links($resourceId)
    {
        $rows = Yii::$app->db->createCommand(
            'SELECT url, title, description, use_proxy, `order`, use_link_visibility, start_visibility, end_visibility '
            . 'FROM resource_links WHERE resource_id = :id '
            . 'ORDER BY `order`, url, title, description, use_proxy, use_link_visibility, start_visibility, end_visibility',
            [':id' => (int)$resourceId]
        )->queryAll();
        return array_map(function ($row) {
            $row['use_proxy'] = (int)$row['use_proxy'];
            $row['use_link_visibility'] = (int)$row['use_link_visibility'];
            $row['order'] = $row['order'] === null ? null : (int)$row['order'];
            return $row;
        }, $rows);
    }
}

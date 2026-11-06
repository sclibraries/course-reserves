<?php

namespace app\services;

use app\models\CourseOfferings;
use app\models\CourseResources;
use app\models\Resources;
use Yii;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;
use yii\web\ServerErrorHttpException;

class ResourceReuseService
{
    private const SETTINGS = [
        'start_visibility' => 'date',
        'end_visibility' => 'date',
        'use_resource_visibility' => 'flag',
        'primary_link_start_visibility' => 'date',
        'primary_link_end_visibility' => 'date',
        'use_primary_link_visibility' => 'flag',
    ];

    public function create(array $input)
    {
        $offeringId = $this->positiveId($input['offering_id'] ?? null);
        $resourceId = $this->positiveId($input['resource_id'] ?? null);
        $errors = [];
        if ($offeringId === null) {
            $errors['offering_id'][] = 'A positive integer is required.';
        }
        if ($resourceId === null) {
            $errors['resource_id'][] = 'A positive integer is required.';
        }
        if (array_key_exists('order', $input) && !is_int($input['order'])) {
            $errors['order'][] = 'Order must be an integer.';
        }

        $settings = $input['settings'] ?? [];
        if (array_key_exists('settings', $input) && !is_array($input['settings'])) {
            $errors['settings'][] = 'Settings must be an object.';
        } else {
            foreach ($settings as $field => $value) {
                if (!isset(self::SETTINGS[$field])) {
                    $errors['settings'][] = 'Unknown setting: ' . $field . '.';
                } elseif (self::SETTINGS[$field] === 'date' && $value !== null && !is_string($value)) {
                    $errors[$field][] = 'Date must be a string or null.';
                } elseif (self::SETTINGS[$field] === 'flag') {
                    if (!in_array($value, [0, 1, '0', '1', true, false], true)) {
                        $errors[$field][] = 'Value must be 0 or 1.';
                    } else {
                        $settings[$field] = (int)$value;
                    }
                }
            }
        }
        if ($errors) {
            return ['status' => 422, 'body' => ['errors' => $errors]];
        }

        if (!CourseOfferings::findOne($offeringId)) {
            throw new NotFoundHttpException('Course offering not found.');
        }
        if (!Resources::findOne($resourceId)) {
            throw new NotFoundHttpException('Resource not found.');
        }

        $model = new CourseResources(array_merge([
            'offering_id' => $offeringId,
            'resource_id' => $resourceId,
            'order' => $input['order'] ?? 999,
            'start_visibility' => null,
            'end_visibility' => null,
            'use_resource_visibility' => 0,
            'primary_link_start_visibility' => null,
            'primary_link_end_visibility' => null,
            'use_primary_link_visibility' => 0,
        ], $settings));

        if (CourseResources::find()->where([
            'offering_id' => $offeringId,
            'resource_id' => $resourceId,
        ])->exists()) {
            throw new ConflictHttpException('Already on this course');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            if (!$model->save()) {
                if ($model->hasErrors()) {
                    $transaction->rollBack();
                    return ['status' => 422, 'body' => ['errors' => $model->errors]];
                }
                throw new ServerErrorHttpException('Failed to save resource association.');
            }
            $transaction->commit();
            return ['status' => 201, 'body' => $model];
        } catch (\Throwable $error) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $error;
        }
    }

    private function positiveId($value)
    {
        if (is_int($value) && $value > 0) {
            return $value;
        }
        if (is_string($value) && ctype_digit($value) && (int)$value > 0) {
            return (int)$value;
        }
        return null;
    }
}

<?php

namespace app\services;

use app\models\SubmissionNewResource;
use yii\web\BadRequestHttpException;

/** Validates the faculty edits permitted on an already submitted request. */
class SubmittedSubmissionUpdateValidator
{
    private $ownership;
    private $payloads;

    public function __construct(
        ?SubmissionOwnershipPolicy $ownership = null,
        ?SubmissionPayloadService $payloads = null
    ) {
        $this->ownership = $ownership ?: new SubmissionOwnershipPolicy();
        $this->payloads = $payloads ?: new SubmissionPayloadService();
    }

    public function validate($submission, array $payload)
    {
        $this->ownership->assertUpdateDoesNotChangeOwnership($payload);
        if (!array_key_exists('items', $payload)) {
            return $payload;
        }
        if (!is_array($payload['items'])) {
            throw new BadRequestHttpException('Resources must be an array');
        }

        $existing = SubmissionNewResource::find()->where([
            'submission_id' => $submission->submission_id,
        ])->indexBy('id')->asArray()->all();
        $resources = [];
        foreach ($payload['items'] as $index => $item) {
            $item = is_array($item) ? $item : [];
            $id = $item['item_uuid'] ?? $item['id'] ?? null;
            $current = isset($existing[$id]) ? json_decode($existing[$id]['resource_data'], true) : [];
            $resources[$index] = [
                'resource_data' => SubmissionMaterializationGuard::buildUpdatedResourceData($current ?: [], $item),
            ];
        }

        $this->payloads->validate([
            'courseCode' => $submission->course_code,
            'courseTitle' => $payload['course_title'] ?? $submission->course_title,
            'term' => $submission->term_code,
        ], $resources);
        return $payload;
    }
}

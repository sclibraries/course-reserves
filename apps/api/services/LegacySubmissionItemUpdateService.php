<?php

namespace app\services;

use Yii;
use app\models\SubmissionNewResource;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;

/** Preserves the legacy staff item update contract inside the shared item lock. */
class LegacySubmissionItemUpdateService
{
    use ServiceResult;

    private $claims;
    private $publication;

    public function __construct($claims = null, $publication = null)
    {
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->publication = $publication ?: new SubmissionPublicationStateService(null, $this->claims);
    }

    public function update($itemId, array $actor, array $data)
    {
        return $this->claims->withLinkedItem('new', $itemId, function ($item, $transaction, $now) use (
            $itemId, $actor, $data
        ) {
            $username = (string)($actor['username'] ?? $actor['id'] ?? '');
            if (!empty($item['claimed_by']) && $item['claimed_by'] !== $username) {
                throw new ConflictHttpException(sprintf(
                    'Item is already claimed by staff user %s and cannot be updated by the current user.',
                    $item['claimed_by']
                ));
            }

            $this->publication->lockForWrite('new', $itemId, $item['submission_id']);
            $record = SubmissionNewResource::findOne((int)$itemId);
            $fields = $this->fields($data);
            if ($fields['error']) {
                throw new BadRequestHttpException($fields['error']);
            }
            foreach ($fields['values'] as $field => $value) {
                $record->$field = $value;
            }
            if (!$record->save()) {
                return $this->result(422, ['errors' => $record->errors]);
            }
            $this->claims->renewClaimLocked('new', $itemId, $now);
            $record->refresh();
            return $this->result(200, [
                'success' => true,
                'item' => $record,
                'message' => 'Item updated successfully',
            ]);
        });
    }

    private function fields(array $data)
    {
        $values = [];
        if (isset($data['item_status'])) {
            $valid = ['pending', 'in_progress', 'complete', 'unavailable'];
            if (!in_array($data['item_status'], $valid, true)) {
                return ['error' => 'Invalid item_status. Must be: pending, in_progress, complete, or unavailable'];
            }
            $values['item_status'] = $data['item_status'];
        }
        foreach (['staff_notes', 'faculty_notes'] as $field) {
            if (isset($data[$field])) {
                $values[$field] = $data[$field];
            }
        }
        if (isset($data['priority']) && in_array($data['priority'], ['high', 'medium', 'low'], true)) {
            $values['priority'] = $data['priority'];
        }
        return ['error' => null, 'values' => $values];
    }
}

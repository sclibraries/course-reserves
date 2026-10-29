<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;
use app\models\SubmissionFolder;
use app\models\SubmissionNewResource;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;

/** Locks, protects, and updates submitted faculty items and folders as one publication-aware write. */
class SubmittedSubmissionUpdateService
{
    private $publication;
    private $guard;
    private $items;

    public function __construct($publication = null, $guard = null, $items = null)
    {
        $this->publication = $publication ?: new SubmissionPublicationStateService();
        $this->guard = $guard ?: new SubmissionMaterializationGuard();
        $this->items = $items ?: new FacultySubmissionItemUpdateService($this->publication);
    }

    public function update($submissionId, array $data)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $submission = FacultySubmission::findBySql(
                'SELECT * FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => (int)$submissionId]
            )->one();
            if (!$submission) {
                throw new NotFoundHttpException('Submission not found');
            }
            if ($submission->isLocked()) {
                $transaction->rollBack();
                return [
                    'status_code' => 423,
                    'body' => [
                        'success' => false,
                        'error' => 'This submission is locked for processing and cannot be edited',
                        'locked_at' => $submission->locked_at,
                        'locked_by' => $submission->locked_by_staff_id,
                        'lock_reason' => $submission->lock_reason,
                    ],
                ];
            }
            if (!$submission->canEdit()) {
                throw new BadRequestHttpException(
                    'Submission cannot be modified in current status: ' . $submission->status
                );
            }

            $lockedItems = SubmissionNewResource::findBySql(
                'SELECT * FROM submission_new_resources WHERE submission_id = :id ORDER BY id FOR UPDATE',
                [':id' => (int)$submissionId]
            )->indexBy('id')->all();
            $existing = [];
            foreach ($lockedItems as $id => $item) {
                $existing[$id] = $item->getAttributes();
                $this->publication->lockForWrite('new', $id, $submissionId);
            }
            $folders = SubmissionFolder::findBySql(
                'SELECT * FROM submission_folders WHERE submission_id = :id ORDER BY folder_name FOR UPDATE',
                [':id' => (int)$submissionId]
            )->indexBy('folder_name')->all();

            $folderData = isset($data['folders']) && is_array($data['folders']) ? $data['folders'] : [];
            $folderNames = SubmissionMaterializationGuard::folderUuidToNameMap($folderData);
            $incoming = isset($data['items']) && is_array($data['items']) ? $data['items'] : [];
            if (!isset($data['items']) && isset($data['folders'])) {
                $incoming = $this->guard->incomingItemsAfterFolderUpdate($existing, $folderData);
            }
            $changedItems = $this->guard->changedMaterializedItemIds($existing, $incoming, $folderNames);
            if ($changedItems) {
                $transaction->rollBack();
                return [
                    'status_code' => 409,
                    'body' => [
                        'success' => false,
                        'error_code' => 'materialized_item_correction_required',
                        'message' => 'Processed course-reserve items must be corrected by library staff.',
                        'submission_uuid' => $submission->submission_uuid,
                        'item_ids' => $changedItems,
                    ],
                ];
            }

            $this->applySubmissionFields($submission, $data);
            if (!$submission->save()) {
                throw new \RuntimeException('Failed to update submission: ' . json_encode($submission->errors));
            }

            $folderMap = isset($data['folders']) ? $this->updateFolders($submission, $folderData, $folders, $lockedItems) : [];
            if (isset($data['items'])) {
                $this->items->updateItems($submission, $data['items'], $folderMap, $lockedItems);
            }
            $transaction->commit();
            return ['submission' => $submission];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            Yii::$app->response->statusCode = 422;
            return ['body' => ['success' => false, 'error' => $exception->getMessage()], 'status_code' => 422];
        }
    }

    private function applySubmissionFields($submission, array $data)
    {
        foreach (['submission_notes', 'needed_by_date', 'course_title', 'section'] as $field) {
            if (isset($data[$field])) {
                $submission->$field = $data[$field];
            }
        }
    }

    private function updateFolders($submission, array $folderData, array $existingFolders, array $lockedItems)
    {
        $folderMap = SubmissionMaterializationGuard::folderUuidToNameMap($folderData);
        $processedNames = [];
        $changedNames = [];
        foreach ($folderData as $data) {
            $name = $data['folder_name'] ?? $data['name'] ?? null;
            if (!$name) {
                Yii::warning('Skipping folder without name: ' . json_encode($data), __METHOD__);
                continue;
            }
            if (isset($existingFolders[$name])) {
                $folder = $existingFolders[$name];
                if (isset($data['display_order']) && (int)$folder->display_order !== (int)$data['display_order']) {
                    $folder->display_order = $data['display_order'];
                    $changedNames[$name] = true;
                }
            } else {
                $folder = new SubmissionFolder();
                $folder->submission_id = $submission->submission_id;
                $folder->folder_name = $name;
                $folder->display_order = $data['display_order'] ?? 999;
                $changedNames[$name] = true;
            }
            $folder->save();
            $processedNames[] = $name;
        }

        $changedItemIds = [];
        foreach ($existingFolders as $name => $folder) {
            if (in_array($name, $processedNames, true)) {
                continue;
            }
            $changedNames[$name] = true;
            foreach ($lockedItems as $item) {
                if ($item->folder_name !== $name) {
                    continue;
                }
                $before = PublicationDraftSnapshot::fromNewItem($item->getAttributes());
                $item->folder_name = null;
                $item->position_in_folder = null;
                $item->save();
                if ($before !== PublicationDraftSnapshot::fromNewItem($item->getAttributes())) {
                    $this->publication->invalidateDraft('new', $item->id, $submission->submission_id);
                    $changedItemIds[(int)$item->id] = true;
                }
            }
            $folder->delete();
        }

        foreach ($lockedItems as $item) {
            if (isset($changedItemIds[(int)$item->id]) || !isset($changedNames[$item->folder_name])) {
                continue;
            }
            $this->publication->invalidateDraft('new', $item->id, $submission->submission_id);
        }
        return $folderMap;
    }
}

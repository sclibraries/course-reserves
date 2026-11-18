<?php

namespace app\services;

use Yii;
use app\models\ChecklistTemplate;
use app\models\ChecklistTemplateTask;
use app\models\FacultySubmission;
use app\models\ItemChecklist;
use app\models\ItemChecklistTask;
use app\models\SubmissionNewResource;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;

/** Owns the locked transaction for checklist assignment, task updates and completion. */
class ChecklistWriteService
{
    private $repository;
    private $claims;
    private $itemLock;

    public function __construct($repository = null, $claims = null, $itemLock = null)
    {
        $this->repository = $repository ?: new ItemClaimRepository();
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->itemLock = $itemLock ?: new ItemWriteLock($this->repository);
    }

    public function assign($itemId, $templateId, $actorId)
    {
        if (empty($templateId)) {
            throw new BadRequestHttpException('template_id is required');
        }

        return Transactional::retrying(function () use ($itemId, $templateId, $actorId) {
            list($submission, $item) = $this->lockItem($itemId);
            if ($blocked = SubmissionLinkGuard::errorResponse($submission)) {
                return $blocked;
            }
            ItemChecklist::findBySql(
                'SELECT * FROM item_checklists WHERE submission_item_id = :id ORDER BY id FOR UPDATE',
                [':id' => $item->id]
            )->all();

            $template = ChecklistTemplate::findBySql(
                'SELECT * FROM checklist_templates WHERE id = :id LOCK IN SHARE MODE',
                [':id' => $templateId]
            )->one();
            if (!$template) {
                throw new NotFoundHttpException('Template not found');
            }
            $templateTasks = ChecklistTemplateTask::findBySql(
                'SELECT * FROM checklist_template_tasks WHERE template_id = :id ORDER BY id LOCK IN SHARE MODE',
                [':id' => $templateId]
            )->all();

            $checklist = new ItemChecklist();
            $checklist->submission_item_id = $item->id;
            $checklist->template_id = $templateId;
            $checklist->assigned_by = $actorId;
            if (!$checklist->save()) {
                throw new BadRequestHttpException('Failed to assign checklist: ' . json_encode($checklist->errors));
            }

            $templateTasksById = [];
            foreach ($templateTasks as $templateTask) {
                $task = new ItemChecklistTask();
                $task->item_checklist_id = $checklist->id;
                $task->template_task_id = $templateTask->id;
                $task->completed = false;
                if (!$task->save()) {
                    throw new BadRequestHttpException('Failed to create task: ' . json_encode($task->errors));
                }
                $task->populateRelation('templateTask', $templateTask);
                $templateTasksById[$templateTask->id] = $task;
            }
            $tasks = array_values($templateTasksById);
            usort($tasks, function ($left, $right) {
                return $left->templateTask->task_order <=> $right->templateTask->task_order;
            });
            $checklist->populateRelation('template', $template);
            $checklist->populateRelation('tasks', $tasks);
            return $checklist->toArray([], ['tasks'], true);
        });
    }

    public function updateTask($itemId, $taskId, array $data, $actorId)
    {
        return Transactional::retrying(function () use ($itemId, $taskId, $data, $actorId) {
            list($submission, $item) = $this->lockItem($itemId);
            if ($blocked = SubmissionLinkGuard::errorResponse($submission)) {
                return $blocked;
            }
            $checklist = $this->lockChecklist($itemId);
            if (!$checklist) {
                throw new NotFoundHttpException('Task not found');
            }
            $tasks = $this->lockTasks($checklist->id);
            $task = null;
            foreach ($tasks as $lockedTask) {
                if ((int)$lockedTask->id === (int)$taskId) {
                    $task = $lockedTask;
                    break;
                }
            }
            if (!$task) {
                throw new NotFoundHttpException('Task not found');
            }

            if (isset($data['completed'])) {
                $task->completed = (bool)$data['completed'];
                $task->completed_at = $task->completed ? date('Y-m-d H:i:s') : null;
                $task->completed_by = $task->completed ? (string)$actorId : null;
            }
            if (isset($data['notes'])) {
                $task->notes = $data['notes'];
            }
            if (!$task->save()) {
                throw new BadRequestHttpException('Failed to update task: ' . json_encode($task->errors));
            }

            $this->claims->recordActivity('new', $this->claimItem($submission, $item));
            return ['success' => true, 'task' => $task->toArrayWithTemplate()];
        });
    }

    public function complete($itemId, $actorId, array $actor)
    {
        return Transactional::retrying(function () use ($itemId, $actorId, $actor) {
            list($submission, $item) = $this->lockItem($itemId);
            if ($blocked = SubmissionLinkGuard::errorResponse($submission)) {
                return $blocked;
            }
            $checklist = $this->lockChecklist($itemId);
            if (!$checklist) {
                throw new NotFoundHttpException('No checklist assigned to this item');
            }
            $tasks = $this->lockTasks($checklist->id);
            $templateTasks = ChecklistTemplateTask::findBySql(
                'SELECT * FROM checklist_template_tasks WHERE template_id = :id ORDER BY id LOCK IN SHARE MODE',
                [':id' => $checklist->template_id]
            )->all();
            if (!$checklist->areRequiredTasksComplete($tasks, $templateTasks)) {
                throw new BadRequestHttpException('All required tasks must be completed first');
            }

            $now = date('Y-m-d H:i:s');
            foreach ($tasks as $task) {
                if ($task->completed) {
                    continue;
                }
                $task->completed = true;
                $task->completed_at = $now;
                $task->completed_by = (string)$actorId;
                if (!$task->save()) {
                    throw new \RuntimeException('Failed to complete checklist task: ' . json_encode($task->errors));
                }
            }

            $checklist->completed_at = $now;
            $checklist->completed_by = (string)$actorId;
            if (!$checklist->save(false)) {
                throw new \RuntimeException('Failed to complete checklist: ' . json_encode($checklist->errors));
            }

            $item->item_status = 'completed';
            $this->claims->completeLegacyChecklistItem('new', $this->claimItem($submission, $item), $actor);
            if (!$item->save(false)) {
                throw new \RuntimeException('Failed to complete item: ' . json_encode($item->errors));
            }
            return ['success' => true, 'message' => 'Item checklist completed'];
        });
    }

    private function lockItem($itemId)
    {
        $locked = $this->itemLock->lock('new', $itemId);
        if ($locked['missing'] === 'submission') {
            throw new NotFoundHttpException('Submission not found');
        }
        if ($locked['missing'] !== null) {
            throw new NotFoundHttpException('Item not found');
        }
        return [$locked['submission'], $locked['item']];
    }

    private function lockChecklist($itemId)
    {
        return ItemChecklist::findBySql(
            'SELECT * FROM item_checklists WHERE submission_item_id = :id ORDER BY id FOR UPDATE',
            [':id' => $itemId]
        )->one();
    }

    private function lockTasks($checklistId)
    {
        return ItemChecklistTask::findBySql(
            'SELECT * FROM item_checklist_tasks WHERE item_checklist_id = :id ORDER BY id FOR UPDATE',
            [':id' => $checklistId]
        )->all();
    }

    private function claimItem(FacultySubmission $submission, SubmissionNewResource $item)
    {
        return [
            'id' => (int)$item->id,
            'submission_id' => (int)$submission->submission_id,
            'status' => $item->item_status,
            'claimed_by' => $item->claimed_by,
            'claimed_at' => $item->claimed_at,
            'last_activity_at' => $item->last_activity_at,
            'assigned_group_id' => $item->assigned_group_id,
            'link_state' => $submission->link_state,
        ];
    }
}

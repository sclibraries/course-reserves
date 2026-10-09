<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\AccessControl;
use yii\filters\Cors;
use app\models\ChecklistTemplate;
use app\models\ChecklistTemplateTask;
use app\models\ItemChecklist;
use app\models\ItemChecklistTask;
use app\models\SubmissionNewResource;
use app\models\User;

class ChecklistController extends Controller
{
    public function init()
    {
        parent::init();
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
    }

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        
        // CORS - must be first
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:5173',
                    'http://localhost:8080',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => [],
            ],
        ];
        
        // Add authentication - exclude OPTIONS
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options'],
        ];
        
        // Add access control - exclude OPTIONS
        $behaviors['access'] = [
            'class' => AccessControl::class,
            'except' => ['options'],
            'rules' => [
                [
                    'allow' => true,
                    'roles' => ['@'], // Authenticated users
                ],
            ],
        ];
        
        return $behaviors;
    }

    public function actionOptions() {
        Yii::info('OPTIONS request received');
        Yii::$app->response->headers->set('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }

    // ============================================
    // TEMPLATE ENDPOINTS
    // ============================================

    /**
     * GET /checklist/list-templates
     * List all active checklist templates
     */
    public function actionListTemplates()
    {
        $templates = ChecklistTemplate::find()
            ->where(['is_active' => true])
            ->orderBy(['name' => SORT_ASC])
            ->all();

        return array_map(function($template) {
            return $template->toArray([], [], false);
        }, $templates);
    }

    /**
     * GET /checklist/get-template?id=1
     * Get a specific template with tasks
     */
    public function actionGetTemplate()
    {
        $id = Yii::$app->request->get('id');
        $template = $this->findTemplate($id);
        return $template->toArray([], ['tasks'], true);
    }

    /**
     * POST /checklist/create-template
     * Create a new template
     */
    public function actionCreateTemplate()
    {
        $data = Yii::$app->request->post();
        
        if (empty($data['name'])) {
            throw new BadRequestHttpException('Name is required');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Create template
            $template = new ChecklistTemplate();
            $template->name = $data['name'];
            $template->description = $data['description'] ?? '';
            $template->format = $data['format'] ?? 'physical';
            $template->setMaterialTypesArray($data['material_types'] ?? []);
            $template->is_active = true;
            
            // Get user ID from username in payload, or use authenticated user's ID
            $createdByUserId = null;
            if (!empty($data['created_by'])) {
                $user = User::findByUsername($data['created_by']);
                if ($user) {
                    $createdByUserId = $user->id;
                }
            } else if (Yii::$app->user->identity) {
                $createdByUserId = Yii::$app->user->identity->id;
            }
            $template->created_by = $createdByUserId;

            if (!$template->save()) {
                throw new BadRequestHttpException('Failed to create template: ' . json_encode($template->errors));
            }

            // Create tasks
            if (!empty($data['tasks'])) {
                foreach ($data['tasks'] as $taskData) {
                    $task = new ChecklistTemplateTask();
                    $task->template_id = $template->id;
                    $task->label = $taskData['label'];
                    $task->help_text = $taskData['help_text'] ?? null;
                    $task->task_order = $taskData['order'];
                    $task->optional = $taskData['optional'] ?? false;

                    if (!$task->save()) {
                        throw new BadRequestHttpException('Failed to create task: ' . json_encode($task->errors));
                    }
                }
            }

            $transaction->commit();
            
            // Reload with tasks
            $template->refresh();
            return $template->toArray([], ['tasks'], true);
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    /**
     * PUT /checklist/update-template?id=1
     * Update an existing template
     */
    public function actionUpdateTemplate()
    {
        $id = Yii::$app->request->get('id');
        $template = $this->findTemplate($id);
        $data = Yii::$app->request->post();

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Update template
            $template->name = $data['name'];
            $template->description = $data['description'] ?? '';
            $template->format = $data['format'] ?? 'physical';
            $template->setMaterialTypesArray($data['material_types'] ?? []);

            if (!$template->save()) {
                throw new BadRequestHttpException('Failed to update template: ' . json_encode($template->errors));
            }

            // Intelligently update tasks instead of deleting all
            $existingTaskIds = [];
            $incomingTaskIds = [];
            
            if (!empty($data['tasks'])) {
                foreach ($data['tasks'] as $taskData) {
                    if (!empty($taskData['id'])) {
                        // Update existing task
                        $task = ChecklistTemplateTask::findOne([
                            'id' => $taskData['id'],
                            'template_id' => $template->id
                        ]);
                        if ($task) {
                            $existingTaskIds[] = $task->id;
                            $incomingTaskIds[] = $task->id;
                        } else {
                            // Task ID provided but doesn't exist or doesn't belong to this template
                            // Create as new task
                            $task = new ChecklistTemplateTask();
                            $task->template_id = $template->id;
                        }
                    } else {
                        // Create new task
                        $task = new ChecklistTemplateTask();
                        $task->template_id = $template->id;
                    }
                    
                    $task->label = $taskData['label'];
                    $task->help_text = $taskData['help_text'] ?? null;
                    $task->task_order = $taskData['order'];
                    $task->optional = $taskData['optional'] ?? false;

                    if (!$task->save()) {
                        throw new BadRequestHttpException('Failed to save task: ' . json_encode($task->errors));
                    }
                    
                    if (!in_array($task->id, $incomingTaskIds)) {
                        $incomingTaskIds[] = $task->id;
                    }
                }
            }
            
            // Delete tasks that were removed (only if no incoming tasks reference them)
            // Get all existing task IDs for this template
            $allExistingTaskIds = ChecklistTemplateTask::find()
                ->select('id')
                ->where(['template_id' => $template->id])
                ->column();
            
            $tasksToDelete = array_diff($allExistingTaskIds, $incomingTaskIds);
            
            if (!empty($tasksToDelete)) {
                // Check if any of these tasks are referenced by item_checklist_tasks
                $referencedTasks = ItemChecklistTask::find()
                    ->select('template_task_id')
                    ->where(['template_task_id' => $tasksToDelete])
                    ->distinct()
                    ->column();
                
                $safeToDelete = array_diff($tasksToDelete, $referencedTasks);
                
                if (!empty($safeToDelete)) {
                    ChecklistTemplateTask::deleteAll(['id' => $safeToDelete]);
                }
                // Note: Tasks that are referenced will remain in the database but not in the updated template
            }

            $transaction->commit();
            
            // Reload with tasks
            $template->refresh();
            return $template->toArray([], ['tasks'], true);
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    /**
     * DELETE /checklist/delete-template?id=1
     * Soft delete a template
     */
    public function actionDeleteTemplate()
    {
        $id = Yii::$app->request->get('id');
        $template = $this->findTemplate($id);
        $template->is_active = false;
        
        if (!$template->save()) {
            throw new BadRequestHttpException('Failed to delete template');
        }

        return ['success' => true, 'message' => 'Template deactivated'];
    }

    /**
     * POST /checklist/duplicate-template?id=1
     * Duplicate a template
     */
    public function actionDuplicateTemplate()
    {
        $id = Yii::$app->request->get('id');
        $template = $this->findTemplate($id);
        
        try {
            $newTemplate = $template->duplicate();
            return $newTemplate->toArray([], ['tasks'], true);
        } catch (\Exception $e) {
            throw new BadRequestHttpException('Failed to duplicate template: ' . $e->getMessage());
        }
    }

    // ============================================
    // ITEM CHECKLIST ENDPOINTS
    // ============================================

    /**
     * GET /checklist/get-item-checklist?itemId=123
     * Get checklist for a specific item
     */
    public function actionGetItemChecklist()
    {
        $itemId = Yii::$app->request->get('itemId');
        
        $checklist = ItemChecklist::find()
            ->where(['submission_item_id' => $itemId])
            ->with(['template', 'tasks.templateTask'])
            ->one();

        if (!$checklist) {
            throw new NotFoundHttpException('No checklist assigned to this item');
        }

        return $checklist->toArray([], ['tasks'], true);
    }

    /**
     * POST /checklist/assign-checklist?itemId=123
     * Assign a checklist template to an item
     */
    public function actionAssignChecklist()
    {
        $itemId = Yii::$app->request->get('itemId');
        $data = Yii::$app->request->post();
        
        if (empty($data['template_id'])) {
            throw new BadRequestHttpException('template_id is required');
        }

        // Check if item exists
        $item = SubmissionNewResource::findOne($itemId);
        if (!$item) {
            throw new NotFoundHttpException('Item not found');
        }

        // Check if template exists
        $template = ChecklistTemplate::findOne($data['template_id']);
        if (!$template) {
            throw new NotFoundHttpException('Template not found');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Create item checklist
            $checklist = new ItemChecklist();
            $checklist->submission_item_id = $itemId;
            $checklist->template_id = $data['template_id'];
            
            // Get user ID from username in payload, or use authenticated user's ID
            $assignedByUserId = null;
            if (!empty($data['assigned_by'])) {
                $user = User::findByUsername($data['assigned_by']);
                if ($user) {
                    $assignedByUserId = $user->id;
                }
            } else if (Yii::$app->user->identity) {
                $assignedByUserId = Yii::$app->user->identity->id;
            }
            $checklist->assigned_by = $assignedByUserId;

            if (!$checklist->save()) {
                throw new BadRequestHttpException('Failed to assign checklist: ' . json_encode($checklist->errors));
            }

            // Copy tasks from template
            foreach ($template->tasks as $templateTask) {
                $task = new ItemChecklistTask();
                $task->item_checklist_id = $checklist->id;
                $task->template_task_id = $templateTask->id;
                $task->completed = false;

                if (!$task->save()) {
                    throw new BadRequestHttpException('Failed to create task: ' . json_encode($task->errors));
                }
            }

            $transaction->commit();
            
            // Reload with tasks
            $checklist->refresh();
            return $checklist->toArray([], ['tasks'], true);
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    /**
     * PATCH /checklist/update-task?itemId=123&taskId=2
     * Update a task's completion status
     */
    public function actionUpdateTask()
    {
        $itemId = Yii::$app->request->get('itemId');
        $taskId = Yii::$app->request->get('taskId');
        $data = Yii::$app->request->post();
        
        $task = ItemChecklistTask::find()
            ->joinWith('itemChecklist')
            ->where([
                'item_checklist_tasks.id' => $taskId,
                'item_checklists.submission_item_id' => $itemId
            ])
            ->one();

        if (!$task) {
            throw new NotFoundHttpException('Task not found');
        }

        // Update completion status
        if (isset($data['completed'])) {
            $task->completed = (bool)$data['completed'];
            
            if ($task->completed) {
                $task->completed_at = date('Y-m-d H:i:s');
                $task->completed_by = Yii::$app->user->id ?? null;
            } else {
                $task->completed_at = null;
                $task->completed_by = null;
            }
        }

        // Update notes
        if (isset($data['notes'])) {
            $task->notes = $data['notes'];
        }

        if (!$task->save()) {
            throw new BadRequestHttpException('Failed to update task: ' . json_encode($task->errors));
        }

        return [
            'success' => true,
            'task' => $task->toArrayWithTemplate()
        ];
    }

    /**
     * POST /checklist/complete-checklist?itemId=123
     * Mark all remaining tasks as complete and finish the item
     */
    public function actionCompleteChecklist()
    {
        $itemId = Yii::$app->request->get('itemId');
        
        $checklist = ItemChecklist::find()
            ->where(['submission_item_id' => $itemId])
            ->one();

        if (!$checklist) {
            throw new NotFoundHttpException('No checklist assigned to this item');
        }

        // Check if all required tasks are complete
        if (!$checklist->areRequiredTasksComplete()) {
            throw new BadRequestHttpException('All required tasks must be completed first');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Mark any remaining optional tasks as complete
            ItemChecklistTask::updateAll(
                [
                    'completed' => true,
                    'completed_at' => date('Y-m-d H:i:s'),
                    'completed_by' => Yii::$app->user->id ?? null
                ],
                [
                    'item_checklist_id' => $checklist->id,
                    'completed' => false
                ]
            );

            // Mark checklist as complete
            $checklist->completed_at = date('Y-m-d H:i:s');
            $checklist->completed_by = Yii::$app->user->id ?? null;
            $checklist->save();

            // Update submission item status
            $item = SubmissionNewResource::findOne($itemId);
            if ($item) {
                $item->item_status = 'completed';
                $item->claimed_by_staff_id = null; // Release from work queue
                $item->save();
            }

            $transaction->commit();

            return [
                'success' => true,
                'message' => 'Item checklist completed'
            ];
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    protected function findTemplate($id)
    {
        $template = ChecklistTemplate::findOne($id);
        if (!$template) {
            throw new NotFoundHttpException('Template not found');
        }
        return $template;
    }
}

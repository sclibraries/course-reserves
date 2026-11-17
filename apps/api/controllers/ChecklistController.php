<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use Yii;
use yii\rest\Controller;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\filters\Cors;
use app\models\ChecklistTemplate;
use app\models\ChecklistTemplateTask;
use app\models\ItemChecklist;
use app\models\ItemChecklistTask;
use app\services\ChecklistWriteService;

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
        
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => [],
            ],
        ];
        
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'list-templates' => Roles::STAFF,
            'get-template' => Roles::STAFF,
            'create-template' => Roles::STAFF,
            'update-template' => Roles::STAFF,
            'delete-template' => Roles::STAFF,
            'duplicate-template' => Roles::STAFF,
            'get-item-checklist' => Roles::STAFF,
            'assign-checklist' => Roles::STAFF,
            'update-task' => Roles::STAFF,
            'complete-checklist' => Roles::STAFF,
        ]);
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
            
            $template->created_by = Yii::$app->user->identity->id;

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
        return Yii::$container->get(ChecklistWriteService::class)->assign(
            Yii::$app->request->get('itemId'),
            Yii::$app->request->post('template_id'),
            Yii::$app->user->identity->id
        );
    }

    /**
     * PATCH /checklist/update-task?itemId=123&taskId=2
     * Update a task's completion status
     */
    public function actionUpdateTask()
    {
        return Yii::$container->get(ChecklistWriteService::class)->updateTask(
            Yii::$app->request->get('itemId'),
            Yii::$app->request->get('taskId'),
            Yii::$app->request->post(),
            Yii::$app->user->identity->id
        );
    }

    /**
     * POST /checklist/complete-checklist?itemId=123
     * Mark all remaining tasks as complete and finish the item
     */
    public function actionCompleteChecklist()
    {
        $identity = Yii::$app->user->identity;
        return Yii::$container->get(ChecklistWriteService::class)->complete(
            Yii::$app->request->get('itemId'),
            $identity->id,
            ['username' => $identity->username ?? (string)$identity->id, 'role' => $identity->role]
        );
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

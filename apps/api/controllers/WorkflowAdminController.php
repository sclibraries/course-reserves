<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\web\NotFoundHttpException;
use yii\web\ForbiddenHttpException;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\Cors;
use app\models\WorkflowTemplate;
use app\models\WorkflowStep;
use app\models\WorkflowCondition;
use app\models\WorkflowStepTransition;
use app\models\WorkflowInstance;
use app\models\WorkflowStepHistory;
use app\models\WorkflowInstanceSteps;
use app\services\FolioService;
use app\services\WorkflowGuard;
use app\services\WorkflowProgress;
use app\services\AutomationDispatcher;

/**
 * Workflow Administration Controller
 * Manage workflow templates, steps, conditions, and execution
 */
class WorkflowAdminController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // CORS configuration - MUST come before authentication
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ];

        // Authentication - skip for OPTIONS requests
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options'], // Skip auth for OPTIONS
        ];

        return \app\components\CorsOriginPolicy::corsFirst($behaviors);
    }

    /**
     * Handle OPTIONS requests
     */
    public function actionOptions($id = null)
    {
        Yii::$app->response->statusCode = 200;
        return [];
    }

    // ==========================================
    // WORKFLOW TEMPLATES
    // ==========================================

    /**
     * List all workflow templates
     * GET /workflow-admin/templates
     */
    public function actionListTemplates()
    {
        $workflowType = Yii::$app->request->get('type'); // 'course' or 'item'
        $isActive = Yii::$app->request->get('active'); // 0 or 1

        $query = WorkflowTemplate::find();

        if ($workflowType) {
            $query->where(['workflow_type' => $workflowType]);
        }

        if ($isActive !== null) {
            $query->andWhere(['is_active' => $isActive]);
        }

        $templates = $query->orderBy(['name' => SORT_ASC])->all();

        return [
            'templates' => array_map(function($template) {
                $formatted = $this->formatTemplate($template, false);
                $formatted['step_count'] = count($template->steps); // Add this
                return $formatted;
            }, $templates)
        ];
    }

    /**
     * Get single template with full details
     * GET /workflow-admin/template/{id}
     */
    public function actionGetTemplate($id)
    {
        $template = $this->findTemplate($id);
        return $this->formatTemplate($template, true);
    }

    /**
     * Create new workflow template
     * POST /workflow-admin/templates
     */
    public function actionCreateTemplate()
    {
        $data = Yii::$app->request->post();

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Create template
            $template = new WorkflowTemplate();
            $template->name = $data['name'] ?? null;
            $template->description = $data['description'] ?? null;
            $template->workflow_type = $data['workflow_type'] ?? null;
            $template->category = $data['category'] ?? null;
            $template->is_active = $data['is_active'] ?? 0;
            $template->trigger_conditions = $data['trigger_conditions'] ?? [];
            $template->metadata = $data['metadata'] ?? [];

            if (!$template->save()) {
                throw new \Exception('Failed to save template: ' . json_encode($template->errors));
            }

            // Create steps
            $stepIdMap = []; // Map frontend temp IDs to real DB IDs
            if (isset($data['steps']) && is_array($data['steps'])) {
                foreach ($data['steps'] as $stepData) {
                    $step = new WorkflowStep();
                    $step->template_id = $template->id;
                    $step->step_key = $stepData['step_key'] ?? null;
                    $step->step_name = $stepData['step_name'] ?? null;
                    $step->step_description = $stepData['step_description'] ?? null;
                    $step->step_type = $stepData['step_type'] ?? 'action';
                    $step->sequence_order = $stepData['sequence_order'] ?? 999;
                    $step->is_required = $stepData['is_required'] ?? 1;
                    $step->is_automated = $stepData['is_automated'] ?? 0;

                    // Gate + automation fields
                    $step->is_gate = $stepData['is_gate'] ?? 0;
                    $step->depends_on = $stepData['depends_on'] ?? [];
                    $step->automation_handler = $stepData['automation_handler'] ?? null;
                    $step->automation_config = $stepData['automation_config'] ?? [];

                    $step->assigned_role = $stepData['assigned_role'] ?? null;
                    $step->estimated_duration_minutes = $stepData['estimated_duration_minutes'] ?? null;
                    $step->instructions = $stepData['instructions'] ?? null;
                    $step->form_fields = $stepData['form_fields'] ?? [];
                    $step->metadata = $stepData['metadata'] ?? [];

                    if (!$step->save()) {
                        throw new \Exception('Failed to save step: ' . json_encode($step->errors));
                    }

                    // Map the step_key to the real ID for transition creation
                    $stepIdMap[$stepData['step_key']] = $step->id;
                }
            }

            // Create conditions
            $conditionIdMap = [];
            if (isset($data['conditions']) && is_array($data['conditions'])) {
                foreach ($data['conditions'] as $conditionData) {
                    $stepKey = $conditionData['step_key'] ?? null;
                    if (!$stepKey || !isset($stepIdMap[$stepKey])) {
                        continue; // Skip if step not found
                    }

                    $condition = new WorkflowCondition();
                    $condition->step_id = $stepIdMap[$stepKey];
                    $condition->condition_key = $conditionData['condition_key'] ?? null;
                    $condition->condition_label = $conditionData['condition_label'] ?? null;
                    $condition->condition_type = $conditionData['condition_type'] ?? 'boolean';
                    $condition->field_name = $conditionData['field_name'] ?? null;
                    $condition->operator = $conditionData['operator'] ?? null;
                    $condition->expected_value = $conditionData['expected_value'] ?? null;
                    $condition->choices = $conditionData['choices'] ?? [];
                    $condition->default_value = $conditionData['default_value'] ?? null;
                    $condition->validation_rules = $conditionData['validation_rules'] ?? [];
                    $condition->metadata = $conditionData['metadata'] ?? [];

                    if (!$condition->save()) {
                        throw new \Exception('Failed to save condition: ' . json_encode($condition->errors));
                    }

                    $conditionIdMap[$conditionData['condition_key'] ?? ''] = $condition->id;
                }
            }

            // Create transitions
            $sequentialMode = false;
            
            Yii::info('Transitions data: ' . json_encode($data['transitions'] ?? 'NOT SET'), 'workflow');
            Yii::info('Step ID map count: ' . count($stepIdMap), 'workflow');
            
            if (isset($data['transitions']) && is_array($data['transitions']) && count($data['transitions']) > 0) {
                // Check if any transition specifies sequential mode
                foreach ($data['transitions'] as $transitionData) {
                    if (($transitionData['transition_type'] ?? null) === 'sequential') {
                        $sequentialMode = true;
                        break;
                    }
                }

                if ($sequentialMode) {
                    // Create sequential transitions between all steps
                    $steps = WorkflowStep::find()
                        ->where(['template_id' => $template->id])
                        ->orderBy(['sequence_order' => SORT_ASC])
                        ->all();

                    for ($i = 0; $i < count($steps) - 1; $i++) {
                        $transition = new WorkflowStepTransition();
                        $transition->from_step_id = $steps[$i]->id;
                        $transition->to_step_id = $steps[$i + 1]->id;
                        $transition->transition_label = 'Next step';
                        $transition->priority = 1;
                        $transition->is_default = 1;
                        $transition->actions = [];
                        $transition->metadata = [];

                        if (!$transition->save()) {
                            throw new \Exception('Failed to save sequential transition: ' . json_encode($transition->errors));
                        }
                    }
                } else {
                    // Create specific transitions
                    foreach ($data['transitions'] as $transitionData) {
                        $fromStepKey = $transitionData['from_step_key'] ?? null;
                        $toStepKey = $transitionData['to_step_key'] ?? null;

                        if (!$fromStepKey || !isset($stepIdMap[$fromStepKey])) {
                            continue;
                        }

                        $transition = new WorkflowStepTransition();
                        $transition->from_step_id = $stepIdMap[$fromStepKey];
                        $transition->to_step_id = isset($stepIdMap[$toStepKey]) ? $stepIdMap[$toStepKey] : null;
                        $transition->condition_id = isset($transitionData['condition_key']) && isset($conditionIdMap[$transitionData['condition_key']]) 
                            ? $conditionIdMap[$transitionData['condition_key']] 
                            : null;
                        $transition->condition_value = $transitionData['condition_value'] ?? null;
                        $transition->transition_label = $transitionData['transition_label'] ?? null;
                        $transition->priority = $transitionData['priority'] ?? 0;
                        $transition->actions = $transitionData['actions'] ?? [];
                        $transition->is_default = $transitionData['is_default'] ?? 0;
                        $transition->metadata = $transitionData['metadata'] ?? [];

                        if (!$transition->save()) {
                            throw new \Exception('Failed to save transition: ' . json_encode($transition->errors));
                        }
                    }
                }
            } elseif (count($stepIdMap) > 1) {
                // No transitions specified at all - default to sequential
                $steps = WorkflowStep::find()
                    ->where(['template_id' => $template->id])
                    ->orderBy(['sequence_order' => SORT_ASC])
                    ->all();

                for ($i = 0; $i < count($steps) - 1; $i++) {
                    $transition = new WorkflowStepTransition();
                    $transition->from_step_id = $steps[$i]->id;
                    $transition->to_step_id = $steps[$i + 1]->id;
                    $transition->transition_label = 'Next step';
                    $transition->priority = 1;
                    $transition->is_default = 1;
                    $transition->actions = [];
                    $transition->metadata = [];

                    if (!$transition->save()) {
                        throw new \Exception('Failed to save default sequential transition: ' . json_encode($transition->errors));
                    }
                }
            }

            $transaction->commit();

            // Reload template with all relations
            $template->refresh();
            return [
                'success' => true,
                'template' => $this->formatTemplate($template, true)
            ];
        } catch (\Exception $e) {
            $transaction->rollBack();
            Yii::$app->response->statusCode = 422;
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Update workflow template
     * PUT /workflow-admin/template/{id}
     */
    public function actionUpdateTemplate($id)
    {
        $template = $this->findTemplate($id);
        $data = Yii::$app->request->getBodyParams();

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // 1) Update template fields
            $template->name = $data['name'] ?? $template->name;
            $template->description = $data['description'] ?? $template->description;
            $template->workflow_type = $data['workflow_type'] ?? $template->workflow_type;
            $template->category = $data['category'] ?? $template->category;
            $template->is_active = $data['is_active'] ?? $template->is_active;
            $template->trigger_conditions = $data['trigger_conditions'] ?? $template->trigger_conditions;
            $template->metadata = $data['metadata'] ?? $template->metadata;

            if (!$template->save()) {
                throw new \Exception('Failed to save template: ' . json_encode($template->errors));
            }

            // 2) Sync steps if provided
            $stepIdMap = []; // Map step_key to DB id
            if (isset($data['steps']) && is_array($data['steps'])) {
                // Build map of existing steps
                $existingSteps = WorkflowStep::find()
                    ->where(['template_id' => $template->id])
                    ->indexBy('id')
                    ->all();

                $existingStepsByKey = [];
                foreach ($existingSteps as $step) {
                    if ($step->step_key) {
                        $existingStepsByKey[$step->step_key] = $step;
                    }
                }

                $processedStepIds = [];

                foreach ($data['steps'] as $stepData) {
                    $step = null;

                    // Try to find existing step by id or step_key
                    if (!empty($stepData['id']) && isset($existingSteps[$stepData['id']])) {
                        $step = $existingSteps[$stepData['id']];
                    } elseif (!empty($stepData['step_key']) && isset($existingStepsByKey[$stepData['step_key']])) {
                        $step = $existingStepsByKey[$stepData['step_key']];
                    }

                    // Create new step if not found
                    if (!$step) {
                        $step = new WorkflowStep();
                        $step->template_id = $template->id;
                    }

                    // Update step fields
                    $step->step_key = $stepData['step_key'] ?? $step->step_key;
                    $step->step_name = $stepData['step_name'] ?? $step->step_name;
                    $step->step_description = $stepData['step_description'] ?? $step->step_description;
                    $step->step_type = $stepData['step_type'] ?? $step->step_type ?? 'action';
                    $step->sequence_order = $stepData['sequence_order'] ?? $step->sequence_order ?? 999;
                    $step->is_required = isset($stepData['is_required']) ? (int)$stepData['is_required'] : ($step->is_required ?? 1);
                    $step->is_automated = isset($stepData['is_automated']) ? (int)$stepData['is_automated'] : ($step->is_automated ?? 0);
                    $step->is_gate = isset($stepData['is_gate']) ? (int)$stepData['is_gate'] : ($step->is_gate ?? 0);
                    $step->depends_on = $stepData['depends_on'] ?? $step->depends_on ?? [];
                    $step->automation_handler = $stepData['automation_handler'] ?? $step->automation_handler;
                    $step->automation_config = $stepData['automation_config'] ?? $step->automation_config ?? [];
                    $step->assigned_role = $stepData['assigned_role'] ?? $step->assigned_role;
                    $step->estimated_duration_minutes = $stepData['estimated_duration_minutes'] ?? $step->estimated_duration_minutes;
                    $step->instructions = $stepData['instructions'] ?? $step->instructions ?? '';
                    $step->form_fields = $stepData['form_fields'] ?? $step->form_fields ?? [];
                    $step->metadata = $stepData['metadata'] ?? $step->metadata ?? [];

                    if (!$step->save()) {
                        throw new \Exception('Failed to save step: ' . json_encode($step->errors));
                    }

                    $processedStepIds[] = $step->id;
                    $stepIdMap[$step->step_key] = $step->id;
                }

                // Delete steps that are no longer in the payload
                foreach ($existingSteps as $existingStep) {
                    if (!in_array($existingStep->id, $processedStepIds)) {
                        $existingStep->delete();
                    }
                }
            }

            // 3) Sync conditions if provided
            $conditionIdMap = [];
            if (isset($data['conditions']) && is_array($data['conditions'])) {
                // Get existing conditions for this template
                $existingConditions = WorkflowCondition::find()
                    ->joinWith('step')
                    ->where(['workflow_steps.template_id' => $template->id])
                    ->indexBy('id')
                    ->all();

                $existingConditionsByKey = [];
                foreach ($existingConditions as $condition) {
                    if ($condition->condition_key) {
                        $existingConditionsByKey[$condition->condition_key] = $condition;
                    }
                }

                $processedConditionIds = [];

                foreach ($data['conditions'] as $conditionData) {
                    $stepKey = $conditionData['step_key'] ?? null;
                    if (!$stepKey || !isset($stepIdMap[$stepKey])) {
                        continue; // Skip if step not found
                    }

                    $condition = null;

                    // Try to find existing condition by id or condition_key
                    if (!empty($conditionData['id']) && isset($existingConditions[$conditionData['id']])) {
                        $condition = $existingConditions[$conditionData['id']];
                    } elseif (!empty($conditionData['condition_key']) && isset($existingConditionsByKey[$conditionData['condition_key']])) {
                        $condition = $existingConditionsByKey[$conditionData['condition_key']];
                    }

                    // Create new condition if not found
                    if (!$condition) {
                        $condition = new WorkflowCondition();
                    }

                    $condition->step_id = $stepIdMap[$stepKey];
                    $condition->condition_key = $conditionData['condition_key'] ?? $condition->condition_key;
                    $condition->condition_label = $conditionData['condition_label'] ?? $condition->condition_label;
                    $condition->condition_type = $conditionData['condition_type'] ?? $condition->condition_type ?? 'boolean';
                    $condition->field_name = $conditionData['field_name'] ?? $condition->field_name;
                    $condition->operator = $conditionData['operator'] ?? $condition->operator;
                    $condition->expected_value = $conditionData['expected_value'] ?? $condition->expected_value;
                    $condition->choices = $conditionData['choices'] ?? $condition->choices ?? [];
                    $condition->default_value = $conditionData['default_value'] ?? $condition->default_value;
                    $condition->validation_rules = $conditionData['validation_rules'] ?? $condition->validation_rules ?? [];
                    $condition->metadata = $conditionData['metadata'] ?? $condition->metadata ?? [];

                    if (!$condition->save()) {
                        throw new \Exception('Failed to save condition: ' . json_encode($condition->errors));
                    }

                    $processedConditionIds[] = $condition->id;
                    $conditionIdMap[$condition->condition_key ?? ''] = $condition->id;
                }

                // Delete conditions that are no longer in the payload
                foreach ($existingConditions as $existingCondition) {
                    if (!in_array($existingCondition->id, $processedConditionIds)) {
                        $existingCondition->delete();
                    }
                }
            }

            // 4) Sync transitions if provided
            if (isset($data['transitions']) && is_array($data['transitions'])) {
                // Delete all existing transitions for this template
                WorkflowStepTransition::deleteAll([
                    'from_step_id' => array_values($stepIdMap)
                ]);

                // Check if sequential mode
                $sequentialMode = false;
                foreach ($data['transitions'] as $transitionData) {
                    if (($transitionData['transition_type'] ?? null) === 'sequential') {
                        $sequentialMode = true;
                        break;
                    }
                }

                if ($sequentialMode) {
                    // Create sequential transitions between all steps
                    $steps = WorkflowStep::find()
                        ->where(['template_id' => $template->id])
                        ->orderBy(['sequence_order' => SORT_ASC])
                        ->all();

                    for ($i = 0; $i < count($steps) - 1; $i++) {
                        $transition = new WorkflowStepTransition();
                        $transition->from_step_id = $steps[$i]->id;
                        $transition->to_step_id = $steps[$i + 1]->id;
                        $transition->transition_label = 'Next step';
                        $transition->priority = 1;
                        $transition->is_default = 1;
                        $transition->actions = [];
                        $transition->metadata = [];

                        if (!$transition->save()) {
                            throw new \Exception('Failed to save sequential transition: ' . json_encode($transition->errors));
                        }
                    }
                } else {
                    // Create specific transitions from payload
                    foreach ($data['transitions'] as $transitionData) {
                        // Handle both step_key and step_id formats
                        $fromStepId = null;
                        $toStepId = null;

                        // Try to resolve from_step
                        if (!empty($transitionData['from_step_id'])) {
                            $fromStepId = $transitionData['from_step_id'];
                        } elseif (!empty($transitionData['from_step_key']) && isset($stepIdMap[$transitionData['from_step_key']])) {
                            $fromStepId = $stepIdMap[$transitionData['from_step_key']];
                        }

                        // Try to resolve to_step
                        if (!empty($transitionData['to_step_id'])) {
                            $toStepId = $transitionData['to_step_id'];
                        } elseif (!empty($transitionData['to_step_key']) && isset($stepIdMap[$transitionData['to_step_key']])) {
                            $toStepId = $stepIdMap[$transitionData['to_step_key']];
                        }

                        if (!$fromStepId) {
                            continue; // Skip if from_step not found
                        }

                        $transition = new WorkflowStepTransition();
                        $transition->from_step_id = $fromStepId;
                        $transition->to_step_id = $toStepId;
                        $transition->condition_id = isset($transitionData['condition_key']) && isset($conditionIdMap[$transitionData['condition_key']]) 
                            ? $conditionIdMap[$transitionData['condition_key']] 
                            : ($transitionData['condition_id'] ?? null);
                        $transition->condition_value = $transitionData['condition_value'] ?? null;
                        $transition->transition_label = $transitionData['transition_label'] ?? null;
                        $transition->priority = $transitionData['priority'] ?? 0;
                        $transition->actions = $transitionData['actions'] ?? [];
                        $transition->is_default = isset($transitionData['is_default']) ? (int)$transitionData['is_default'] : 0;
                        $transition->metadata = $transitionData['metadata'] ?? [];

                        if (!$transition->save()) {
                            throw new \Exception('Failed to save transition: ' . json_encode($transition->errors));
                        }
                    }
                }
            }

            $transaction->commit();

            // Reload template with all relations
            $template->refresh();
            return [
                'success' => true,
                'template' => $this->formatTemplate($template, true)
            ];
        } catch (\Exception $e) {
            $transaction->rollBack();
            Yii::$app->response->statusCode = 422;
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Delete workflow template
     * DELETE /workflow-admin/template/{id}
     */
    public function actionDeleteTemplate($id)
    {
        $template = $this->findTemplate($id);

        // Check if template has ANY instances (completed or otherwise) to prevent FK violation
        $instanceCount = WorkflowInstance::find()->where(['template_id' => $id])->count();

        if ($instanceCount > 0) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => "Cannot delete template: {$instanceCount} workflow instance(s) reference this template. Archive or migrate instances first."
            ];
        }

        try {
            if ($template->delete()) {
                return ['success' => true];
            }
            Yii::$app->response->statusCode = 500;
            return ['success' => false, 'message' => 'Failed to delete template'];
        } catch (\yii\db\IntegrityException $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => 'Deletion blocked by existing workflow instances (DB constraint). Archive or remove instances first.',
                'error' => $e->getMessage()
            ];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 500;
            return [
                'success' => false,
                'message' => 'Unexpected error deleting template',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Archive (deactivate) workflow template without deleting historical instances
     * POST /workflow-admin/template/{id}/archive
     */
    public function actionArchiveTemplate($id)
    {
        $template = $this->findTemplate($id);

        if ((int)$template->is_active === 0) {
            return [
                'success' => true,
                'message' => 'Template already archived',
                'template' => $this->formatTemplate($template, false)
            ];
        }

        $template->is_active = 0;
        if ($template->save(false)) {
            return [
                'success' => true,
                'template' => $this->formatTemplate($template, false)
            ];
        }

        Yii::$app->response->statusCode = 500;
        return [
            'success' => false,
            'message' => 'Failed to archive template'
        ];
    }

    /**
     * Duplicate workflow template
     * POST /workflow-admin/template/{id}/duplicate
     */
    public function actionDuplicateTemplate($id)
    {
        $template = $this->findTemplate($id);

        try {
            $newTemplate = $template->duplicate();
            return [
                'success' => true,
                'template' => $this->formatTemplate($newTemplate, true)
            ];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 500;
            return [
                'success' => false,
                'message' => 'Failed to duplicate template: ' . $e->getMessage()
            ];
        }
    }

    // ==========================================
    // WORKFLOW STEPS
    // ==========================================

    /**
     * Create workflow step
     * POST /workflow-admin/template/{templateId}/steps
     */
    public function actionCreateStep($templateId)
    {
        $template = $this->findTemplate($templateId);
        $data = Yii::$app->request->post();

        $step = new WorkflowStep();
        $step->template_id = $template->id;
        $step->step_key = $data['step_key'] ?? null;
        $step->step_name = $data['step_name'] ?? null;
        $step->step_description = $data['step_description'] ?? null;
        $step->step_type = $data['step_type'] ?? 'action';
        $step->sequence_order = $data['sequence_order'] ?? 999;
        $step->is_required = $data['is_required'] ?? 1;
    $step->is_automated = $data['is_automated'] ?? 0;

    // Gate + automation fields
    $step->is_gate = $data['is_gate'] ?? 0;
    $step->depends_on = $data['depends_on'] ?? [];
    $step->automation_handler = $data['automation_handler'] ?? null;
    $step->automation_config = $data['automation_config'] ?? [];

    $step->assigned_role = $data['assigned_role'] ?? null;
        $step->estimated_duration_minutes = $data['estimated_duration_minutes'] ?? null;
        $step->instructions = $data['instructions'] ?? null;
        $step->form_fields = $data['form_fields'] ?? [];
        $step->metadata = $data['metadata'] ?? [];

        if ($step->save()) {
            return [
                'success' => true,
                'step' => $this->formatStep($step)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $step->errors];
        }
    }

    /**
     * Update workflow step
     * PUT /workflow-admin/step/{id}
     */
    public function actionUpdateStep($id)
    {
        $step = $this->findStep($id);
        $data = Yii::$app->request->getBodyParams();

        foreach ([
            'step_key',
            'step_name',
            'step_description',
            'step_type',
            'sequence_order',
            'is_required',
            'is_automated',
            'is_gate',
            'depends_on',
            'automation_handler',
            'automation_config',
            'assigned_role',
            'estimated_duration_minutes',
            'instructions',
            'form_fields',
            'metadata',
        ] as $attr) {
            if (array_key_exists($attr, $data)) {
                $step->$attr = $data[$attr];
            }
        }

        if ($step->save()) {
            return [
                'success' => true,
                'step' => $this->formatStep($step)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $step->errors];
        }
    }

    /**
     * Delete workflow step
     * DELETE /workflow-admin/step/{id}
     */
    public function actionDeleteStep($id)
    {
        $step = $this->findStep($id);

        if ($step->delete()) {
            return ['success' => true];
        } else {
            Yii::$app->response->statusCode = 500;
            return ['success' => false];
        }
    }

    /**
     * Reorder steps
     * PUT /workflow-admin/template/{templateId}/steps/reorder
     */
    public function actionReorderSteps($templateId)
    {
        $template = $this->findTemplate($templateId);
        $stepIds = Yii::$app->request->post('step_ids', []); // Array of step IDs in new order

        $transaction = Yii::$app->db->beginTransaction();
        try {
            foreach ($stepIds as $index => $stepId) {
                $step = WorkflowStep::findOne([
                    'id' => $stepId,
                    'template_id' => $templateId
                ]);
                
                if ($step) {
                    $step->sequence_order = $index + 1;
                    $step->save(false);
                }
            }

            $transaction->commit();
            return ['success' => true];
        } catch (\Exception $e) {
            $transaction->rollBack();
            Yii::$app->response->statusCode = 500;
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ==========================================
    // WORKFLOW CONDITIONS
    // ==========================================

    /**
     * Create condition for a step
     * POST /workflow-admin/step/{stepId}/conditions
     */
    public function actionCreateCondition($stepId)
    {
        $step = $this->findStep($stepId);
        $data = Yii::$app->request->post();

        $condition = new WorkflowCondition();
        $condition->step_id = $step->id;
        $condition->condition_key = $data['condition_key'] ?? null;
        $condition->condition_label = $data['condition_label'] ?? null;
        $condition->condition_type = $data['condition_type'] ?? 'boolean';
        $condition->field_name = $data['field_name'] ?? null;
        $condition->operator = $data['operator'] ?? null;
        $condition->expected_value = $data['expected_value'] ?? null;
        $condition->choices = $data['choices'] ?? [];
        $condition->default_value = $data['default_value'] ?? null;
        $condition->validation_rules = $data['validation_rules'] ?? [];
        $condition->metadata = $data['metadata'] ?? [];

        if ($condition->save()) {
            return [
                'success' => true,
                'condition' => $this->formatCondition($condition)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $condition->errors];
        }
    }

    /**
     * Update condition
     * PUT /workflow-admin/condition/{id}
     */
    public function actionUpdateCondition($id)
    {
        $condition = $this->findCondition($id);
        $data = Yii::$app->request->getBodyParams();

        foreach (['condition_key', 'condition_label', 'condition_type', 'field_name',
                  'operator', 'expected_value', 'choices', 'default_value', 
                  'validation_rules', 'metadata'] as $attr) {
            if (isset($data[$attr])) {
                $condition->$attr = $data[$attr];
            }
        }

        if ($condition->save()) {
            return [
                'success' => true,
                'condition' => $this->formatCondition($condition)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $condition->errors];
        }
    }

    /**
     * Delete condition
     * DELETE /workflow-admin/condition/{id}
     */
    public function actionDeleteCondition($id)
    {
        $condition = $this->findCondition($id);

        if ($condition->delete()) {
            return ['success' => true];
        } else {
            Yii::$app->response->statusCode = 500;
            return ['success' => false];
        }
    }

    // ==========================================
    // WORKFLOW TRANSITIONS
    // ==========================================

    /**
     * Create transition between steps
     * POST /workflow-admin/transitions
     */
    public function actionCreateTransition()
    {
        $data = Yii::$app->request->post();

        $transition = new WorkflowStepTransition();
        $transition->from_step_id = $data['from_step_id'] ?? null;
        $transition->to_step_id = $data['to_step_id'] ?? null;
        $transition->condition_id = $data['condition_id'] ?? null;
        $transition->condition_value = $data['condition_value'] ?? null;
        $transition->transition_label = $data['transition_label'] ?? null;
        $transition->priority = $data['priority'] ?? 0;
        $transition->actions = $data['actions'] ?? [];
        $transition->is_default = $data['is_default'] ?? 0;
        $transition->metadata = $data['metadata'] ?? [];

        if ($transition->save()) {
            return [
                'success' => true,
                'transition' => $this->formatTransition($transition)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $transition->errors];
        }
    }

    /**
     * Update transition
     * PUT /workflow-admin/transition/{id}
     */
    public function actionUpdateTransition($id)
    {
        $transition = $this->findTransition($id);
        $data = Yii::$app->request->getBodyParams();

        foreach (['from_step_id', 'to_step_id', 'condition_id', 'condition_value',
                  'transition_label', 'priority', 'actions', 'is_default', 'metadata'] as $attr) {
            if (isset($data[$attr])) {
                $transition->$attr = $data[$attr];
            }
        }

        if ($transition->save()) {
            return [
                'success' => true,
                'transition' => $this->formatTransition($transition)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $transition->errors];
        }
    }

    /**
     * Delete transition
     * DELETE /workflow-admin/transition/{id}
     */
    public function actionDeleteTransition($id)
    {
        $transition = $this->findTransition($id);

        if ($transition->delete()) {
            return ['success' => true];
        } else {
            Yii::$app->response->statusCode = 500;
            return ['success' => false];
        }
    }

    // ==========================================
    // WORKFLOW INSTANCES (Execution)
    // ==========================================

    /**
     * List workflow instances
     * GET /workflow-admin/instances
     */
    public function actionListInstances()
    {
        $status = Yii::$app->request->get('status');
        $entityType = Yii::$app->request->get('entity_type');
        $entityId = Yii::$app->request->get('entity_id');
        $assignedTo = Yii::$app->request->get('assigned_to');

    $query = WorkflowInstance::find()->with(['template', 'currentStep', 'instanceSteps.step']);

        if ($status) {
            $query->andWhere(['status' => $status]);
        }
        if ($entityType) {
            $query->andWhere(['entity_type' => $entityType]);
        }
        if ($entityId) {
            $query->andWhere(['entity_id' => $entityId]);
        }
        if ($assignedTo) {
            $query->andWhere(['assigned_to_user_id' => $assignedTo]);
        }

        $instances = $query->orderBy(['created_at' => SORT_DESC])->all();

        return [
            'instances' => array_map(function($instance) {
                return $this->formatInstance($instance);
            }, $instances)
        ];
    }

    /**
     * Get single workflow instance with history
     * GET /workflow-admin/instance/{id}
     */
    public function actionGetInstance($id)
    {
        $instance = $this->findInstance($id);
        return $this->formatInstance($instance, true);
    }

    /**
     * Create and start workflow instance
     * POST /workflow-admin/instances
     */
    public function actionCreateInstance()
    {
        $data = Yii::$app->request->post();

        $template = $this->findTemplate($data['template_id']);

        $instance = new WorkflowInstance();
        $instance->template_id = $template->id;
        $instance->template_version = $template->version;
        $instance->entity_type = $data['entity_type'] ?? null;
        $instance->entity_id = $data['entity_id'] ?? null;
        $instance->submission_id = $data['submission_id'] ?? null;
        $instance->priority = $data['priority'] ?? WorkflowInstance::PRIORITY_NORMAL;
        $instance->due_date = $data['due_date'] ?? null;
        $instance->workflow_data = $data['workflow_data'] ?? [];
        $instance->metadata = $data['metadata'] ?? [];

        if ($instance->save()) {
            $this->bootstrapInstanceSteps($instance);

            // Optionally auto-start
            if ($data['auto_start'] ?? false) {
                $instance->start();
                $instance->refresh();
                $this->bootstrapInstanceSteps($instance);
            }

            $instance->progress_percentage = WorkflowProgress::computeRequiredOnly($instance->id);
            $instance->status = WorkflowProgress::deriveStatus($instance->id);
            $instance->save(false);

            $instance->refresh();

            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $instance->errors];
        }
    }

    /**
     * Start workflow instance
     * POST /workflow-admin/instance/{id}/start
     */
    public function actionStartInstance($id)
    {
        $instance = $this->findInstance($id);

        try {
            $instance->start();
            $this->bootstrapInstanceSteps($instance);
            $instance->progress_percentage = WorkflowProgress::computeRequiredOnly($instance->id);
            $instance->status = WorkflowProgress::deriveStatus($instance->id);
            $instance->save(false);
            $instance->refresh();
            
            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true)
            ];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Complete current step
     * POST /workflow-admin/instance/{id}/complete-step
     */
    public function actionCompleteStep($id)
    {
        $instance = $this->findInstance($id);
        
        // Get POST data and ensure it's properly formatted
        $bodyParams = Yii::$app->request->getBodyParams();
        
        // Debug logging
        Yii::info('Complete step POST data: ' . print_r($bodyParams, true), 'workflow');
        
        $stepData = [];
        if (isset($bodyParams['step_data'])) {
            if (is_object($bodyParams['step_data'])) {
                $stepData = (array)$bodyParams['step_data'];
            } elseif (is_array($bodyParams['step_data'])) {
                $stepData = $bodyParams['step_data'];
            }
        }
        
        $conditionResults = [];
        if (isset($bodyParams['condition_results'])) {
            if (is_object($bodyParams['condition_results'])) {
                $conditionResults = (array)$bodyParams['condition_results'];
            } elseif (is_array($bodyParams['condition_results'])) {
                $conditionResults = $bodyParams['condition_results'];
            }
        }
        
        // Additional validation - ensure no closures in data
        array_walk_recursive($stepData, function($value) {
            if ($value instanceof \Closure) {
                throw new \Exception('Closure detected in step_data');
            }
        });
        
        array_walk_recursive($conditionResults, function($value) {
            if ($value instanceof \Closure) {
                throw new \Exception('Closure detected in condition_results');
            }
        });

        try {
            $instance->completeStep($stepData, $conditionResults);
            $instance->refresh();
            
            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true)
            ];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'trace' => YII_DEBUG ? $e->getTraceAsString() : null
            ];
        }
    }

    /**
     * Skip current step
     * POST /workflow-admin/instance/{id}/skip-step
     */
    public function actionSkipStep($id)
    {
        $instance = $this->findInstance($id);
        $reason = Yii::$app->request->post('reason', '');

        try {
            $instance->skipStep($reason);
            $instance->refresh();
            
            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true)
            ];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Go back to previous step
     * POST /workflow-admin/instance/{id}/go-back
     */
    public function actionGoBack($id)
    {
        $instance = $this->findInstance($id);
        $reason = Yii::$app->request->post('reason', 'User went back to previous step');

        try {
            // Find the last completed step from history
            $lastCompletedHistory = WorkflowStepHistory::find()
                ->where([
                    'instance_id' => $instance->id,
                    'status' => 'completed'
                ])
                ->orderBy(['completed_at' => SORT_DESC])
                ->one();

            if (!$lastCompletedHistory) {
                throw new \Exception('No previous step to go back to');
            }

            $previousStep = WorkflowStep::findOne($lastCompletedHistory->step_id);
            if (!$previousStep) {
                throw new \Exception('Previous step not found');
            }

            // Log going back
            $user = Yii::$app->user->identity;
            $currentStepHistory = new WorkflowStepHistory();
            $currentStepHistory->instance_id = $instance->id;
            $currentStepHistory->step_id = $instance->current_step_id ?? $previousStep->id;
            $currentStepHistory->step_key = $instance->currentStep->step_key ?? $previousStep->step_key;
            $currentStepHistory->status = 'reverted';
            $currentStepHistory->notes = $reason;
            $currentStepHistory->result_data = [];
            $currentStepHistory->condition_results = [];
            if ($user) {
                $currentStepHistory->completed_by_user_id = (string)$user->id;
                $currentStepHistory->completed_by_name = $user->full_name ?? $user->username;
            }
            $currentStepHistory->completed_at = date('Y-m-d H:i:s');
            $currentStepHistory->save();

            $currentStepId = $instance->current_step_id ?? $previousStep->id;

            $currentInstanceStep = WorkflowInstanceSteps::findOne([
                'instance_id' => $instance->id,
                'step_id' => $currentStepId,
            ]);

            if ($currentInstanceStep) {
                $currentInstanceStep->status = WorkflowInstanceSteps::STATUS_NOT_STARTED;
                $currentInstanceStep->started_at = null;
                $currentInstanceStep->completed_at = null;
                $currentInstanceStep->blocked_reason = null;
                $currentInstanceStep->skip_reason = null;
                $currentInstanceStep->version = (int)$currentInstanceStep->version + 1;
                $currentInstanceStep->save(false);
            }

            $previousInstanceStep = WorkflowInstanceSteps::findOne([
                'instance_id' => $instance->id,
                'step_id' => $previousStep->id,
            ]);

            if ($previousInstanceStep) {
                $previousInstanceStep->status = WorkflowInstanceSteps::STATUS_IN_PROGRESS;
                $previousInstanceStep->completed_at = null;
                $previousInstanceStep->blocked_reason = null;
                $previousInstanceStep->skip_reason = null;
                if (!$previousInstanceStep->started_at) {
                    $previousInstanceStep->started_at = date('Y-m-d H:i:s');
                }
                $previousInstanceStep->version = (int)$previousInstanceStep->version + 1;
                $previousInstanceStep->save(false);
            }

            // Move back to previous step
            $instance->current_step_id = $previousStep->id;
            $instance->assigned_to_role = $previousStep->assigned_role;
            $instance->status = WorkflowInstance::STATUS_IN_PROGRESS;
            $instance->completed_at = null;
            $instance->progress_percentage = WorkflowProgress::computeRequiredOnly($instance->id);
            $instance->save(false);

            // Log restarting the previous step
            $restartHistory = new WorkflowStepHistory();
            $restartHistory->instance_id = $instance->id;
            $restartHistory->step_id = $previousStep->id;
            $restartHistory->step_key = $previousStep->step_key;
            $restartHistory->status = 'started';
            $restartHistory->notes = 'Restarted after going back';
            $restartHistory->result_data = [];
            $restartHistory->condition_results = [];
            $restartHistory->started_at = date('Y-m-d H:i:s');
            $restartHistory->save();

            $instance->refresh();
            
            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true),
                'message' => "Moved back to step: {$previousStep->step_name}"
            ];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Cancel workflow instance
     * POST /workflow-admin/instance/{id}/cancel
     */
    public function actionCancelInstance($id)
    {
        $instance = $this->findInstance($id);
        $reason = Yii::$app->request->post('reason', '');

        if ($instance->cancel($reason)) {
            $instance->refresh();
            
            return ['success' => true];
        } else {
            Yii::$app->response->statusCode = 500;
            return ['success' => false];
        }
    }

    /**
     * Put workflow on hold
     * POST /workflow-admin/instance/{id}/hold
     */
    public function actionHoldInstance($id)
    {
        $instance = $this->findInstance($id);
        $reason = Yii::$app->request->post('reason', '');

        if ($instance->putOnHold($reason)) {
            $instance->refresh();
            
            return ['success' => true];
        } else {
            Yii::$app->response->statusCode = 500;
            return ['success' => false];
        }
    }

    /**
     * Resume workflow from hold
     * POST /workflow-admin/instance/{id}/resume
     */
    public function actionResumeInstance($id)
    {
        $instance = $this->findInstance($id);

        try {
            $instance->resume();
            $instance->refresh();
            
            return ['success' => true];
        } catch (\Exception $e) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Link and verify a FOLIO course for a gate step.
     * POST /workflow-admin/instance/{id}/steps/{stepId}/folio/link
     */
    public function actionLinkFolioCourse($id, $stepId)
    {
        $instance = $this->findInstance($id);
        $body = Yii::$app->request->getBodyParams();

        $courseId = isset($body['course_id']) ? $body['course_id'] : null;
        $termId = isset($body['term_id']) ? $body['term_id'] : null;

        if (!$courseId || !$termId) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'code' => 'MISSING_IDENTIFIERS',
                'message' => 'Provide course_id and term_id',
            ];
        }

        $instanceStep = WorkflowInstanceSteps::findOne([
            'instance_id' => $instance->id,
            'step_id' => $stepId,
        ]);

        if (!$instanceStep) {
            Yii::$app->response->statusCode = 404;
            return ['success' => false, 'message' => 'Step not in instance'];
        }

        $step = $instanceStep->step ?: WorkflowStep::findOne($stepId);

        // Sanity checks: this endpoint should be used for the specific gate/automated step
        if (!$step) {
            Yii::$app->response->statusCode = 404;
            return ['success' => false, 'message' => 'Workflow step not found'];
        }

        if (!$step->is_gate || !$step->is_automated) {
            Yii::$app->response->statusCode = 409;
            return [
                'success' => false,
                'code' => 'STEP_NOT_CONFIGURED_AS_GATE',
                'message' => 'This step is not configured as an automated gate step.',
            ];
        }

        if ($step->automation_handler && $step->automation_handler !== 'ensure_course_and_offering') {
            Yii::$app->response->statusCode = 409;
            return [
                'success' => false,
                'code' => 'UNEXPECTED_AUTOMATION_HANDLER',
                'message' => 'This step has a different automation handler than expected for FOLIO linking.',
            ];
        }

        if ($instanceStep->status === WorkflowInstanceSteps::STATUS_COMPLETED) {
            Yii::$app->response->statusCode = 409;
            return [
                'success' => false,
                'code' => 'STEP_ALREADY_COMPLETED',
                'message' => 'This step has already been completed.',
            ];
        }

        $transaction = Yii::$app->db->beginTransaction();

        try {
            $folioService = new FolioService();
            $course = $folioService->fetchCourseById($courseId);
            $ids = $folioService->extractIds($course);

            $workflowData = $instance->workflow_data;
            if (!is_array($workflowData)) {
                $workflowData = [];
            }

            $workflowData['folio_link'] = [
                'course_id' => $ids['course_id'],
                'course_listing_id' => $ids['course_listing_id'],
                'term_id' => $termId,
                'verified_by_user_id' => (string)(Yii::$app->user->id ?? ''),
                'verified_at' => date('Y-m-d H:i:s'),
                'source' => 'pasted_id',
            ];

            $instance->workflow_data = $workflowData;
            $instance->save(false);

            if ($instanceStep->status === WorkflowInstanceSteps::STATUS_NOT_STARTED) {
                $instanceStep->status = WorkflowInstanceSteps::STATUS_IN_PROGRESS;
                if (!$instanceStep->started_at) {
                    $instanceStep->started_at = date('Y-m-d H:i:s');
                }
                $instanceStep->version = (int)$instanceStep->version + 1;
                $instanceStep->save(false);
            }

            $result = AutomationDispatcher::run($instance, $instanceStep, 'ensure_course_and_offering', [
                'folio_course_id' => $ids['course_id'],
                'term_id' => $termId,
            ]);

            $instanceStep->status = WorkflowInstanceSteps::STATUS_COMPLETED;
            $instanceStep->blocked_reason = null;
            $instanceStep->skip_reason = null;
            $instanceStep->completed_at = date('Y-m-d H:i:s');
            $instanceStep->version = (int)$instanceStep->version + 1;
            $instanceStep->save(false);

            $userIdentity = Yii::$app->user->identity;
            $userName = $userIdentity ? ($userIdentity->full_name ?? $userIdentity->username) : null;
            $userId = $userIdentity ? (string)$userIdentity->id : null;

            $userHistory = new WorkflowStepHistory([
                'instance_id' => $instance->id,
                'step_id' => $instanceStep->step_id,
                'step_key' => $step ? $step->step_key : null,
                'status' => WorkflowStepHistory::STATUS_COMPLETED,
                'actor_type' => 'user',
                'result_data' => [
                    'action' => 'link',
                    'folio_course_id' => $ids['course_id'],
                    'folio_course_listing_id' => $ids['course_listing_id'],
                    'term_id' => $termId,
                ],
                'completed_by_user_id' => $userId,
                'completed_by_name' => $userName,
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            $userHistory->save(false);

            $automationHistory = new WorkflowStepHistory([
                'instance_id' => $instance->id,
                'step_id' => $instanceStep->step_id,
                'step_key' => $step ? $step->step_key : null,
                'status' => WorkflowStepHistory::STATUS_COMPLETED,
                'actor_type' => 'automation',
                'result_data' => $result,
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            $automationHistory->save(false);

            $instance->progress_percentage = WorkflowProgress::computeRequiredOnly($instance->id);
            $instance->status = WorkflowProgress::deriveStatus($instance->id);
            $instance->save(false);

            $transaction->commit();
            $instance->refresh();

            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true)
            ];
        } catch (\Throwable $e) {
            $transaction->rollBack();

            $instanceStep->status = WorkflowInstanceSteps::STATUS_BLOCKED;
            $instanceStep->blocked_reason = $e->getMessage();
            $instanceStep->version = (int)$instanceStep->version + 1;
            $instanceStep->save(false);

            $blockedHistory = new WorkflowStepHistory([
                'instance_id' => $instance->id,
                'step_id' => $instanceStep->step_id,
                'step_key' => $step ? $step->step_key : null,
                'status' => WorkflowStepHistory::STATUS_BLOCKED,
                'actor_type' => 'automation',
                'error_code' => $e->getCode() ? (string)$e->getCode() : null,
                'notes' => $e->getMessage(),
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            $blockedHistory->save(false);

            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'code' => $e->getCode() ? (string)$e->getCode() : null,
            ];
        }
    }

    /**
     * Run an automation handler for a workflow step.
     * POST /workflow-admin/instance/{id}/steps/{stepId}/automations/run
     */
    public function actionRunAutomation($id, $stepId)
    {
        $instance = $this->findInstance($id);
        $instanceStep = WorkflowInstanceSteps::findOne([
            'instance_id' => $instance->id,
            'step_id' => $stepId,
        ]);

        if (!$instanceStep) {
            Yii::$app->response->statusCode = 404;
            return ['success' => false, 'message' => 'Step not in instance'];
        }

        $step = $instanceStep->step ?: WorkflowStep::findOne($stepId);
        $body = Yii::$app->request->getBodyParams();

        // Use the step's configured automation_handler as the primary intent
        $intentFromStep = $step ? $step->automation_handler : null;
        $intentFromBody = isset($body['intent']) ? $body['intent'] : null;

        // Final intent: step config wins; fall back to body for legacy/debug use
        $intent = $intentFromStep ?: $intentFromBody;
        $payload = isset($body['payload']) && is_array($body['payload']) ? $body['payload'] : [];

        // Validate: we must have an intent at this point
        if (!$intent) {
            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'code' => 'MISSING_AUTOMATION_HANDLER',
                'message' => 'No automation handler configured for this step.',
            ];
        }

        if ($step && $step->is_automated && !$step->automation_handler) {
            Yii::$app->response->statusCode = 500;
            return [
                'success' => false,
                'code' => 'AUTOMATED_STEP_MISSING_HANDLER',
                'message' => 'Step is marked as automated but no automation_handler is configured.',
            ];
        }

        $transaction = Yii::$app->db->beginTransaction();

        try {
            if ($instanceStep->status === WorkflowInstanceSteps::STATUS_NOT_STARTED) {
                $instanceStep->status = WorkflowInstanceSteps::STATUS_IN_PROGRESS;
                $instanceStep->started_at = date('Y-m-d H:i:s');
                $instanceStep->version = (int)$instanceStep->version + 1;
                $instanceStep->save(false);

                $startedHistory = new WorkflowStepHistory([
                    'instance_id' => $instance->id,
                    'step_id' => $instanceStep->step_id,
                    'step_key' => $step ? $step->step_key : null,
                    'status' => WorkflowStepHistory::STATUS_STARTED,
                    'actor_type' => 'system',
                    'started_at' => date('Y-m-d H:i:s'),
                ]);
                $startedHistory->save(false);
            }

            $result = AutomationDispatcher::run($instance, $instanceStep, $intent, $payload);

            $instanceStep->status = WorkflowInstanceSteps::STATUS_COMPLETED;
            $instanceStep->blocked_reason = null;
            $instanceStep->completed_at = date('Y-m-d H:i:s');
            $instanceStep->version = (int)$instanceStep->version + 1;
            $instanceStep->save(false);

            $history = new WorkflowStepHistory([
                'instance_id' => $instance->id,
                'step_id' => $instanceStep->step_id,
                'step_key' => $step ? $step->step_key : null,
                'status' => WorkflowStepHistory::STATUS_COMPLETED,
                'actor_type' => 'automation',
                'result_data' => $result,
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            $history->save(false);

            $instance->progress_percentage = WorkflowProgress::computeRequiredOnly($instance->id);
            $instance->status = WorkflowProgress::deriveStatus($instance->id);
            $instance->save(false);

            $transaction->commit();
            $instance->refresh();

            return [
                'success' => true,
                'instance' => $this->formatInstance($instance, true)
            ];
        } catch (\Throwable $e) {
            $transaction->rollBack();

            $instanceStep->status = WorkflowInstanceSteps::STATUS_BLOCKED;
            $instanceStep->blocked_reason = $e->getMessage();
            $instanceStep->version = (int)$instanceStep->version + 1;
            $instanceStep->save(false);

            $history = new WorkflowStepHistory([
                'instance_id' => $instance->id,
                'step_id' => $instanceStep->step_id,
                'step_key' => $step ? $step->step_key : null,
                'status' => WorkflowStepHistory::STATUS_BLOCKED,
                'actor_type' => 'automation',
                'error_code' => $e->getCode() ? (string)$e->getCode() : null,
                'notes' => $e->getMessage(),
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            $history->save(false);

            Yii::$app->response->statusCode = 400;
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'code' => $e->getCode() ? (string)$e->getCode() : null,
            ];
        }
    }

    /**
     * Checklist-style step transition endpoint.
     * PATCH /workflow-admin/instance/{id}/steps/{stepId}/transition
     */
    public function actionTransitionStep($id, $stepId)
    {
        $instance = $this->findInstance($id);
        $instanceStep = WorkflowInstanceSteps::findOne([
            'instance_id' => $instance->id,
            'step_id' => $stepId,
        ]);

        if (!$instanceStep) {
            Yii::$app->response->statusCode = 404;
            return ['success' => false, 'message' => 'Step not in instance'];
        }

        $step = $instanceStep->step ?: WorkflowStep::findOne($stepId);
        $body = Yii::$app->request->getBodyParams();
        $action = isset($body['action']) ? $body['action'] : null;
        $notes = isset($body['notes']) ? $body['notes'] : null;
        $reason = isset($body['reason']) ? $body['reason'] : null;

        // Prevent completing automated steps via generic checklist endpoint
        if ($action === 'complete' && $step) {
            if ($step->is_automated && $step->automation_handler) {
                Yii::$app->response->statusCode = 409;
                return [
                    'success' => false,
                    'code' => 'AUTOMATED_STEP_USE_AUTOMATION_ENDPOINT',
                    'message' => 'This step is completed via an automation handler, not the checklist endpoint.',
                ];
            }
        }

        if (!WorkflowGuard::canTransition($instanceStep->status, $action)) {
            Yii::$app->response->statusCode = 400;
            return ['success' => false, 'code' => 'INVALID_TRANSITION'];
        }

        if ($action === 'complete') {
            list($ok, $blockers) = WorkflowGuard::canComplete($instance, $stepId);
            if (!$ok) {
                Yii::$app->response->statusCode = 409;
                return ['success' => false, 'code' => 'WORKFLOW_GATED', 'blockers' => $blockers];
            }
        }

        $now = date('Y-m-d H:i:s');

        switch ($action) {
            case 'start':
                $instanceStep->status = WorkflowInstanceSteps::STATUS_IN_PROGRESS;
                if (!$instanceStep->started_at) {
                    $instanceStep->started_at = $now;
                }
                $instanceStep->blocked_reason = null;
                $instanceStep->skip_reason = null;
                break;
            case 'complete':
                $instanceStep->status = WorkflowInstanceSteps::STATUS_COMPLETED;
                $instanceStep->completed_at = $now;
                $instanceStep->blocked_reason = null;
                $instanceStep->skip_reason = null;
                break;
            case 'block':
                $instanceStep->status = WorkflowInstanceSteps::STATUS_BLOCKED;
                $instanceStep->blocked_reason = $reason ?: $notes;
                break;
            case 'skip':
                $instanceStep->status = WorkflowInstanceSteps::STATUS_SKIPPED;
                $instanceStep->skip_reason = $reason ?: $notes;
                $instanceStep->completed_at = $now;
                break;
            case 'revert':
                $instanceStep->status = WorkflowInstanceSteps::STATUS_NOT_STARTED;
                $instanceStep->started_at = null;
                $instanceStep->completed_at = null;
                $instanceStep->blocked_reason = null;
                $instanceStep->skip_reason = null;
                break;
            case 'assign':
                $instanceStep->assigned_to_user_id = isset($body['assignee_user_id']) ? $body['assignee_user_id'] : null;
                $instanceStep->assigned_to_role = isset($body['assignee_role']) ? $body['assignee_role'] : null;
                break;
        }

        $instanceStep->version = (int)$instanceStep->version + 1;
        $instanceStep->save(false);

        $historyStatusMap = [
            'start' => WorkflowStepHistory::STATUS_STARTED,
            'complete' => WorkflowStepHistory::STATUS_COMPLETED,
            'block' => WorkflowStepHistory::STATUS_BLOCKED,
            'skip' => WorkflowStepHistory::STATUS_SKIPPED,
            'revert' => WorkflowStepHistory::STATUS_REVERTED,
            'assign' => WorkflowStepHistory::STATUS_ASSIGNED,
        ];

        $userIdentity = Yii::$app->user->identity;
        $userName = $userIdentity ? ($userIdentity->full_name ?? $userIdentity->username) : null;
        $userId = $userIdentity ? (string)$userIdentity->id : null;

        $history = new WorkflowStepHistory([
            'instance_id' => $instance->id,
            'step_id' => $instanceStep->step_id,
            'step_key' => $step ? $step->step_key : null,
            'status' => isset($historyStatusMap[$action]) ? $historyStatusMap[$action] : $action,
            'notes' => $notes ?: $reason,
            'actor_type' => 'user',
            'completed_by_user_id' => $userId,
            'completed_by_name' => $userName,
            'started_at' => $action === 'start' ? $now : null,
            'completed_at' => in_array($action, ['complete', 'skip', 'revert'], true) ? $now : null,
        ]);
        $history->save(false);

        $instance->progress_percentage = WorkflowProgress::computeRequiredOnly($instance->id);
        $instance->status = WorkflowProgress::deriveStatus($instance->id);
        $instance->save(false);

        $instance->refresh();

        return [
            'success' => true,
            'instance' => $this->formatInstance($instance, true)
        ];
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    private function bootstrapInstanceSteps(WorkflowInstance $instance)
    {
        $stepIds = (new \yii\db\Query())
            ->select(['id'])
            ->from('workflow_steps')
            ->where(['template_id' => $instance->template_id])
            ->column();

        foreach ($stepIds as $stepId) {
            $exists = WorkflowInstanceSteps::find()
                ->where(['instance_id' => $instance->id, 'step_id' => $stepId])
                ->exists();

            if ($exists) {
                continue;
            }

            $record = new WorkflowInstanceSteps();
            $record->instance_id = $instance->id;
            $record->step_id = (int)$stepId;
            $record->status = WorkflowInstanceSteps::STATUS_NOT_STARTED;
            $record->save(false);
        }

        if ($instance->current_step_id) {
            $current = WorkflowInstanceSteps::findOne([
                'instance_id' => $instance->id,
                'step_id' => $instance->current_step_id,
            ]);

            if ($current && $current->status === WorkflowInstanceSteps::STATUS_NOT_STARTED) {
                $current->status = WorkflowInstanceSteps::STATUS_IN_PROGRESS;
                if (!$current->started_at) {
                    $current->started_at = date('Y-m-d H:i:s');
                }
                $current->version = (int)$current->version + 1;
                $current->save(false);
            }
        }
    }

    protected function findTemplate($id)
    {
        $model = WorkflowTemplate::findOne($id);
        if (!$model) {
            throw new NotFoundHttpException('Workflow template not found');
        }
        return $model;
    }

    protected function findStep($id)
    {
        $model = WorkflowStep::findOne($id);
        if (!$model) {
            throw new NotFoundHttpException('Workflow step not found');
        }
        return $model;
    }

    protected function findCondition($id)
    {
        $model = WorkflowCondition::findOne($id);
        if (!$model) {
            throw new NotFoundHttpException('Workflow condition not found');
        }
        return $model;
    }

    protected function findTransition($id)
    {
        $model = WorkflowStepTransition::findOne($id);
        if (!$model) {
            throw new NotFoundHttpException('Workflow transition not found');
        }
        return $model;
    }

    protected function findInstance($id)
    {
        $model = WorkflowInstance::find()
            ->with(['template', 'currentStep', 'instanceSteps.step', 'history.step'])
            ->where(['id' => $id])
            ->one();
        if (!$model) {
            throw new NotFoundHttpException('Workflow instance not found');
        }
        return $model;
    }

    protected function formatTemplate($template, $includeSteps = false)
    {
        $data = [
            'id' => $template->id,
            'name' => $template->name,
            'template_name' => $template->name, // Add this alias for consistency
            'description' => $template->description,
            'workflow_type' => $template->workflow_type,
            'entity_type' => $template->workflow_type, // Add this alias for frontend compatibility
            'category' => $template->category,
            'is_active' => (bool)$template->is_active,
            'version' => $template->version,
            'trigger_conditions' => $template->trigger_conditions,
            'metadata' => $template->metadata,
            'created_at' => $template->created_at,
            'updated_at' => $template->updated_at,
        ];

        if ($includeSteps) {
            $data['steps'] = array_map(function($step) {
                return $this->formatStep($step, true);
            }, $template->steps);
            
            // Get all conditions and transitions for the template
            $data['conditions'] = [];
            $data['transitions'] = [];
            
            foreach ($template->steps as $step) {
                foreach ($step->conditions as $condition) {
                    $data['conditions'][] = $this->formatCondition($condition);
                }
                foreach ($step->transitions as $transition) {
                    $data['transitions'][] = $this->formatTransition($transition);
                }
            }
        }

        return $data;
    }   

    protected function formatStep($step, $includeDetails = false)
    {
        $data = [
            'id' => $step->id,
            'template_id' => $step->template_id,
            'step_key' => $step->step_key,
            'step_name' => $step->step_name,
            'step_description' => $step->step_description,
            'step_type' => $step->step_type,
            'sequence_order' => $step->sequence_order,
            'is_required' => (bool)$step->is_required,
            'is_automated' => (bool)$step->is_automated,
            'is_gate' => (bool)$step->is_gate,
            'assigned_role' => $step->assigned_role,
            'estimated_duration_minutes' => $step->estimated_duration_minutes,
            'instructions' => $step->instructions,
            'form_fields' => $step->form_fields,
            'depends_on' => $step->depends_on,
            'automation_handler' => $step->automation_handler,
            'automation_config' => $step->automation_config,
            'metadata' => $step->metadata,
        ];

        if ($includeDetails) {
            $data['conditions'] = array_map(function($condition) {
                return $this->formatCondition($condition);
            }, $step->conditions);

            $data['transitions'] = array_map(function($transition) {
                return $this->formatTransition($transition);
            }, $step->transitions);
        }

        return $data;
    }

    protected function formatCondition($condition)
    {
        return [
            'id' => $condition->id,
            'step_id' => $condition->step_id,
            'condition_key' => $condition->condition_key,
            'condition_label' => $condition->condition_label,
            'condition_type' => $condition->condition_type,
            'field_name' => $condition->field_name,
            'operator' => $condition->operator,
            'expected_value' => $condition->expected_value,
            'choices' => $condition->choices,
            'default_value' => $condition->default_value,
            'validation_rules' => $condition->validation_rules,
            'metadata' => $condition->metadata,
        ];
    }

    protected function formatTransition($transition)
    {
        return [
            'id' => $transition->id,
            'from_step_id' => $transition->from_step_id,
            'to_step_id' => $transition->to_step_id,
            'condition_id' => $transition->condition_id,
            'condition_value' => $transition->condition_value,
            'transition_label' => $transition->transition_label,
            'priority' => $transition->priority,
            'actions' => $transition->actions,
            'is_default' => (bool)$transition->is_default,
            'metadata' => $transition->metadata,
        ];
    }

    protected function formatInstance($instance, $includeHistory = false)
    {
        $data = [
            'id' => $instance->id,
            'template_id' => $instance->template_id,
            'template_name' => $instance->template->name ?? null,
            'template_version' => $instance->template_version,
            'entity_type' => $instance->entity_type,
            'entity_id' => $instance->entity_id,
            'submission_id' => $instance->submission_id,
            'current_step_id' => $instance->current_step_id,
            'current_step_name' => $instance->currentStep->step_name ?? null,
            'status' => $instance->status,
            'progress_percentage' => (float)$instance->progress_percentage,
            'progress_mode' => $instance->progress_mode,
            'assigned_to_user_id' => $instance->assigned_to_user_id,
            'assigned_to_role' => $instance->assigned_to_role,
            'started_at' => $instance->started_at,
            'completed_at' => $instance->completed_at,
            'due_date' => $instance->due_date,
            'priority' => $instance->priority,
            'workflow_data' => $instance->workflow_data,
            'metadata' => $instance->metadata,
            'created_at' => $instance->created_at,
            'updated_at' => $instance->updated_at,
        ];

        if ($instance->currentStep) {
            $data['current_step'] = [
                'id' => $instance->currentStep->id,
                'name' => $instance->currentStep->step_name,
                'step_key' => $instance->currentStep->step_key,
                'description' => $instance->currentStep->step_description,
                'step_type' => $instance->currentStep->step_type,
                'step_order' => $instance->currentStep->sequence_order,
                'sequence_order' => $instance->currentStep->sequence_order,
                'is_required' => (bool)$instance->currentStep->is_required,
                'is_automated' => (bool)$instance->currentStep->is_automated,
                'is_gate' => (bool)$instance->currentStep->is_gate,
                'depends_on' => $instance->currentStep->depends_on,
                'automation_handler' => $instance->currentStep->automation_handler,
                'automation_config' => $instance->currentStep->automation_config,
                'instructions' => $instance->currentStep->instructions,
                'assigned_role' => $instance->currentStep->assigned_role,
                'estimated_duration_minutes' => $instance->currentStep->estimated_duration_minutes,
                'form_fields' => $instance->currentStep->form_fields,
                'metadata' => $instance->currentStep->metadata,
            ];
        }

        $steps = $instance->instanceSteps;
        if ($steps !== null) {
            $data['steps'] = array_map(function($instanceStep) {
                $step = $instanceStep->step;
                return [
                    'instance_step_id' => $instanceStep->id,
                    'step_id' => $instanceStep->step_id,
                    'step_key' => $step ? $step->step_key : null,
                    'step_name' => $step ? $step->step_name : null,
                    'sequence_order' => $step ? $step->sequence_order : null,
                    'is_required' => $step ? (bool)$step->is_required : null,
                    'is_automated' => $step ? (bool)$step->is_automated : null,
                    'is_gate' => $step ? (bool)$step->is_gate : null,
                    'depends_on' => $step ? $step->depends_on : null,
                    'automation_handler' => $step ? $step->automation_handler : null,
                    'automation_config' => $step ? $step->automation_config : null,
                    'status' => $instanceStep->status,
                    'blocked_reason' => $instanceStep->blocked_reason,
                    'skip_reason' => $instanceStep->skip_reason,
                    'assigned_to_user_id' => $instanceStep->assigned_to_user_id,
                    'assigned_to_role' => $instanceStep->assigned_to_role,
                    'started_at' => $instanceStep->started_at,
                    'completed_at' => $instanceStep->completed_at,
                    'version' => (int)$instanceStep->version,
                ];
            }, $steps);
        }

        if ($includeHistory) {
            $data['history'] = array_map(function($history) {
                return [
                    'id' => $history->id,
                    'step_id' => $history->step_id,
                    'step_key' => $history->step_key,
                    'step_name' => $history->step->step_name ?? null,
                    'status' => $history->status,
                    'result_data' => $history->result_data,
                    'condition_results' => $history->condition_results,
                    'notes' => $history->notes,
                    'completed_by_user_id' => $history->completed_by_user_id,
                    'completed_by_name' => $history->completed_by_name,
                    'started_at' => $history->started_at,
                    'completed_at' => $history->completed_at,
                    'duration_minutes' => $history->duration_minutes,
                ];
            }, $instance->history);
        }

        return $data;
    }
}

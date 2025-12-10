# Workflow System Integration Guide

## Overview

This guide explains how to integrate the workflow system with the faculty submission system to automatically create and execute workflows when faculty submit course reserve requests.

## Architecture

### Workflow Types

1. **Course-Level Workflows**: Applied to entire course submissions

   - Triggered when a new faculty submission is received
   - Manages the overall course setup and approval process
   - Ends with locking the submission when complete

2. **Item-Level Workflows**: Applied to individual items within a submission
   - Triggered based on material type (book, article, video, etc.)
   - Manages processing of individual resources
   - Can run in parallel for different items

## Auto-Creation Integration

### Backend Integration Point

The workflow auto-creation should be triggered in your faculty submission ingestion process. Here's where to add it:

**File**: `app/controllers/FacultySubmissionController.php` (or equivalent)

```php
<?php

namespace app\controllers;

use Yii;
use app\models\FacultySubmission;
use app\models\WorkflowTemplate;
use app\models\WorkflowInstance;

class FacultySubmissionController extends Controller
{
    /**
     * Process incoming faculty submission
     * This is called when faculty submit a new course reserve request
     */
    public function actionCreate()
    {
        $transaction = Yii::$app->db->beginTransaction();

        try {
            $data = Yii::$app->request->post();

            // Create the submission record
            $submission = new FacultySubmission();
            $submission->load($data);

            if (!$submission->save()) {
                throw new \Exception('Failed to save submission');
            }

            // AUTO-CREATE COURSE WORKFLOW
            $this->autoCreateCourseWorkflow($submission);

            // AUTO-CREATE ITEM WORKFLOWS (for each item in submission)
            foreach ($submission->items as $item) {
                $this->autoCreateItemWorkflow($submission, $item);
            }

            $transaction->commit();

            return [
                'success' => true,
                'submission_id' => $submission->id,
                'workflows_created' => true
            ];

        } catch (\Exception $e) {
            $transaction->rollBack();
            Yii::error('Submission creation failed: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Auto-create course-level workflow
     */
    protected function autoCreateCourseWorkflow($submission)
    {
        // Find active course workflow template with auto_apply enabled
        $template = WorkflowTemplate::find()
            ->where([
                'workflow_type' => 'course',
                'is_active' => 1
            ])
            ->andWhere(['like', 'metadata', '"auto_apply":true'])
            ->one();

        if (!$template) {
            Yii::warning("No auto-apply course workflow template found");
            return null;
        }

        // Check if workflow already exists for this submission
        $existing = WorkflowInstance::find()
            ->where([
                'entity_type' => 'course',
                'submission_id' => $submission->id
            ])
            ->exists();

        if ($existing) {
            return null; // Already has a workflow
        }

        // Create workflow instance
        $instance = new WorkflowInstance();
        $instance->template_id = $template->id;
        $instance->template_version = $template->version;
        $instance->entity_type = 'course';
        $instance->entity_id = $submission->course_id ?? $submission->id;
        $instance->submission_id = $submission->id;
        $instance->priority = $this->determinePriority($submission);
        $instance->due_date = $this->calculateDueDate($submission);
        $instance->workflow_data = [
            'course_code' => $submission->course_code,
            'faculty_name' => $submission->faculty_name,
            'term' => $submission->term
        ];

        if ($instance->save()) {
            // Auto-start the workflow
            $instance->start();

            Yii::info("Course workflow created and started: Instance #{$instance->id}");
            return $instance;
        }

        return null;
    }

    /**
     * Auto-create item-level workflow
     */
    protected function autoCreateItemWorkflow($submission, $item)
    {
        // Determine material category
        $category = $this->getMaterialCategory($item);

        // Find matching item workflow template
        $template = WorkflowTemplate::find()
            ->where([
                'workflow_type' => 'item',
                'category' => $category,
                'is_active' => 1
            ])
            ->one();

        if (!$template) {
            // Try default item workflow
            $template = WorkflowTemplate::find()
                ->where([
                    'workflow_type' => 'item',
                    'category' => 'default',
                    'is_active' => 1
                ])
                ->one();
        }

        if (!$template) {
            Yii::warning("No workflow template found for category: {$category}");
            return null;
        }

        // Create workflow instance
        $instance = new WorkflowInstance();
        $instance->template_id = $template->id;
        $instance->template_version = $template->version;
        $instance->entity_type = 'item';
        $instance->entity_id = $item->id;
        $instance->submission_id = $submission->id;
        $instance->priority = $this->determinePriority($submission);
        $instance->due_date = $this->calculateDueDate($submission);
        $instance->workflow_data = [
            'title' => $item->title,
            'material_type' => $item->material_type,
            'category' => $category
        ];

        if ($instance->save()) {
            Yii::info("Item workflow created: Instance #{$instance->id} for item #{$item->id}");
            return $instance;
        }

        return null;
    }

    /**
     * Map item material type to workflow category
     */
    protected function getMaterialCategory($item)
    {
        $materialType = strtolower($item->material_type ?? '');

        $mapping = [
            'book' => 'book',
            'physical book' => 'book',
            'print book' => 'book',
            'ebook' => 'ebook',
            'e-book' => 'ebook',
            'electronic book' => 'ebook',
            'article' => 'article',
            'journal article' => 'article',
            'journal' => 'article',
            'video' => 'video',
            'streaming video' => 'video',
            'dvd' => 'video',
            'film' => 'video',
            'link' => 'link',
            'url' => 'link',
            'website' => 'link',
        ];

        return $mapping[$materialType] ?? 'default';
    }

    /**
     * Determine workflow priority based on submission metadata
     */
    protected function determinePriority($submission)
    {
        // Check if this is a rush request
        if ($submission->is_rush || $submission->priority === 'urgent') {
            return WorkflowInstance::PRIORITY_URGENT;
        }

        // Check course start date proximity
        if ($submission->course_start_date) {
            $daysUntilStart = (strtotime($submission->course_start_date) - time()) / (60 * 60 * 24);

            if ($daysUntilStart <= 7) {
                return WorkflowInstance::PRIORITY_HIGH;
            } elseif ($daysUntilStart <= 14) {
                return WorkflowInstance::PRIORITY_NORMAL;
            }
        }

        return WorkflowInstance::PRIORITY_NORMAL;
    }

    /**
     * Calculate workflow due date
     */
    protected function calculateDueDate($submission)
    {
        if ($submission->course_start_date) {
            // Due 3 days before course start
            return date('Y-m-d', strtotime($submission->course_start_date . ' -3 days'));
        }

        // Default: 14 days from submission
        return date('Y-m-d', strtotime('+14 days'));
    }
}
```

## Workflow Model Methods

Add these methods to your `WorkflowInstance` model to handle workflow execution:

**File**: `app/models/WorkflowInstance.php`

```php
<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

class WorkflowInstance extends ActiveRecord
{
    const STATUS_NOT_STARTED = 'not_started';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_ON_HOLD = 'on_hold';

    const PRIORITY_LOW = 'low';
    const PRIORITY_NORMAL = 'normal';
    const PRIORITY_HIGH = 'high';
    const PRIORITY_URGENT = 'urgent';

    /**
     * Start the workflow - move to first step
     */
    public function start()
    {
        if ($this->status !== self::STATUS_NOT_STARTED) {
            throw new \Exception('Workflow already started');
        }

        // Get first step
        $firstStep = WorkflowStep::find()
            ->where(['template_id' => $this->template_id])
            ->orderBy(['sequence_order' => SORT_ASC])
            ->one();

        if (!$firstStep) {
            throw new \Exception('No steps defined for workflow');
        }

        $transaction = Yii::$app->db->beginTransaction();

        try {
            // Update instance
            $this->status = self::STATUS_IN_PROGRESS;
            $this->current_step_id = $firstStep->id;
            $this->started_at = date('Y-m-d H:i:s');
            $this->assigned_to_user_id = Yii::$app->user->id;

            if (!$this->save(false)) {
                throw new \Exception('Failed to start workflow');
            }

            // Create history entry
            $history = new WorkflowStepHistory();
            $history->instance_id = $this->id;
            $history->step_id = $firstStep->id;
            $history->step_key = $firstStep->step_key;
            $history->status = 'started';
            $history->started_at = date('Y-m-d H:i:s');
            $history->completed_by_user_id = Yii::$app->user->id;
            $history->completed_by_name = Yii::$app->user->identity->display_name ?? Yii::$app->user->identity->username;
            $history->save(false);

            $transaction->commit();
            return true;

        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    /**
     * Complete current step and advance to next
     */
    public function completeStep($stepData = [], $conditionResults = [])
    {
        if ($this->status !== self::STATUS_IN_PROGRESS) {
            throw new \Exception('Workflow is not in progress');
        }

        if (!$this->current_step_id) {
            throw new \Exception('No current step');
        }

        $transaction = Yii::$app->db->beginTransaction();

        try {
            // Update current step history
            $history = WorkflowStepHistory::find()
                ->where([
                    'instance_id' => $this->id,
                    'step_id' => $this->current_step_id,
                    'status' => 'started'
                ])
                ->one();

            if ($history) {
                $history->status = 'completed';
                $history->result_data = $stepData;
                $history->condition_results = $conditionResults;
                $history->completed_at = date('Y-m-d H:i:s');
                $history->completed_by_user_id = Yii::$app->user->id;
                $history->completed_by_name = Yii::$app->user->identity->display_name ?? Yii::$app->user->identity->username;
                $history->duration_minutes = round((strtotime($history->completed_at) - strtotime($history->started_at)) / 60);
                $history->save(false);
            }

            // Merge step data into workflow_data
            $workflowData = $this->workflow_data ?? [];
            $this->workflow_data = array_merge($workflowData, $stepData);

            // Determine next step
            $nextStep = $this->determineNextStep($this->current_step_id, $conditionResults);

            // Update progress
            $this->updateProgress();

            if ($nextStep) {
                // Move to next step
                $this->current_step_id = $nextStep->id;
                $this->save(false);

                // Create history for next step
                $nextHistory = new WorkflowStepHistory();
                $nextHistory->instance_id = $this->id;
                $nextHistory->step_id = $nextStep->id;
                $nextHistory->step_key = $nextStep->step_key;
                $nextHistory->status = 'started';
                $nextHistory->started_at = date('Y-m-d H:i:s');
                $nextHistory->completed_by_user_id = Yii::$app->user->id;
                $nextHistory->completed_by_name = Yii::$app->user->identity->display_name ?? Yii::$app->user->identity->username;
                $nextHistory->save(false);
            } else {
                // Workflow complete
                $this->completeWorkflow();
            }

            $transaction->commit();
            return true;

        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    /**
     * Complete the entire workflow and execute final actions
     */
    protected function completeWorkflow()
    {
        $this->status = self::STATUS_COMPLETED;
        $this->current_step_id = null;
        $this->completed_at = date('Y-m-d H:i:s');
        $this->progress_percentage = 100;
        $this->save(false);

        // Execute final actions from template metadata
        $this->executeFinalActions();

        Yii::info("Workflow completed: Instance #{$this->id}");
    }

    /**
     * Execute final actions defined in template
     */
    protected function executeFinalActions()
    {
        $template = $this->template;
        if (!$template || !$template->metadata) {
            return;
        }

        $finalActions = $template->metadata['final_actions'] ?? [];

        foreach ($finalActions as $action) {
            if (!($action['enabled'] ?? true)) {
                continue;
            }

            switch ($action['type']) {
                case 'lock_submission':
                    $this->lockSubmission();
                    break;

                case 'notify_faculty':
                    $this->notifyFaculty();
                    break;

                case 'create_lms_links':
                    $this->createLMSLinks();
                    break;
            }
        }
    }

    /**
     * Lock the associated submission
     */
    protected function lockSubmission()
    {
        if (!$this->submission_id) {
            return;
        }

        $submission = FacultySubmission::findOne($this->submission_id);
        if ($submission) {
            $submission->is_locked = 1;
            $submission->locked_at = date('Y-m-d H:i:s');
            $submission->locked_by = Yii::$app->user->id;
            $submission->locked_reason = 'Workflow completed';
            $submission->save(false);

            Yii::info("Submission #{$submission->id} locked by workflow");
        }
    }

    /**
     * Send notification to faculty
     */
    protected function notifyFaculty()
    {
        if (!$this->submission_id) {
            return;
        }

        $submission = FacultySubmission::findOne($this->submission_id);
        if ($submission && $submission->faculty_email) {
            // Trigger notification (implement based on your notification system)
            Yii::info("Sending completion notification to faculty: {$submission->faculty_email}");

            // Example:
            // NotificationService::send([
            //     'to' => $submission->faculty_email,
            //     'subject' => 'Your course reserves are ready',
            //     'template' => 'course_complete',
            //     'data' => ['submission' => $submission]
            // ]);
        }
    }

    /**
     * Create LMS integration links
     */
    protected function createLMSLinks()
    {
        // Implement based on your LMS integration
        Yii::info("Creating LMS links for submission #{$this->submission_id}");
    }

    /**
     * Determine next step based on transitions and conditions
     */
    protected function determineNextStep($currentStepId, $conditionResults)
    {
        $transitions = WorkflowStepTransition::find()
            ->where(['from_step_id' => $currentStepId])
            ->orderBy(['priority' => SORT_DESC, 'is_default' => SORT_DESC])
            ->all();

        foreach ($transitions as $transition) {
            // Check if condition is met
            if ($transition->condition_id) {
                $condition = WorkflowCondition::findOne($transition->condition_id);
                if ($condition) {
                    $conditionValue = $conditionResults[$condition->condition_key] ?? null;

                    if ($conditionValue == $transition->condition_value) {
                        return $transition->to_step_id ? WorkflowStep::findOne($transition->to_step_id) : null;
                    }
                }
            } elseif ($transition->is_default) {
                // Use default transition
                return $transition->to_step_id ? WorkflowStep::findOne($transition->to_step_id) : null;
            }
        }

        // No matching transition found - end workflow
        return null;
    }

    /**
     * Update workflow progress percentage
     */
    protected function updateProgress()
    {
        $totalSteps = WorkflowStep::find()
            ->where(['template_id' => $this->template_id])
            ->count();

        $completedSteps = WorkflowStepHistory::find()
            ->where(['instance_id' => $this->id, 'status' => 'completed'])
            ->count();

        $this->progress_percentage = $totalSteps > 0 ? round(($completedSteps / $totalSteps) * 100, 2) : 0;
    }

    /**
     * Relations
     */
    public function getTemplate()
    {
        return $this->hasOne(WorkflowTemplate::class, ['id' => 'template_id']);
    }

    public function getCurrentStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'current_step_id']);
    }

    public function getHistory()
    {
        return $this->hasMany(WorkflowStepHistory::class, ['instance_id' => 'id'])
            ->orderBy(['started_at' => SORT_ASC]);
    }

    public function getSubmission()
    {
        return $this->hasOne(FacultySubmission::class, ['id' => 'submission_id']);
    }
}
```

## Setup Steps

### 1. Install Workflow Templates

Run the SQL script to create preset templates:

```bash
mysql -u your_user -p your_database < db/migrations/workflow_templates_course_presets.sql
```

### 2. Configure Auto-Apply

Ensure the course workflow templates have `auto_apply` enabled in their metadata:

```sql
UPDATE workflow_templates
SET metadata = JSON_SET(metadata, '$.auto_apply', true)
WHERE workflow_type = 'course'
AND category = 'course';
```

### 3. Test Workflow Creation

Test with a sample submission:

```php
// In your test or controller
$submission = FacultySubmission::findOne(['id' => 123]);
$controller = new FacultySubmissionController('test', Yii::$app);
$workflow = $controller->autoCreateCourseWorkflow($submission);

if ($workflow) {
    echo "Workflow created: Instance #{$workflow->id}\n";
    echo "Current step: {$workflow->currentStep->step_name}\n";
}
```

### 4. Monitor Workflows

Use the admin interface to monitor active workflows:

```
http://your-app/admin?tab=workflows
```

## Frontend Integration

The workflows will automatically appear in:

1. **Submission Detail View** (`SubmissionDetail.jsx`) - Shows workflow for entire submission
2. **My Work Queue** - Items claimed by staff show their item workflows
3. **Workflow Panel** (`WorkflowPanel.jsx`) - Displays progress and allows step completion

## Troubleshooting

### Workflows Not Auto-Creating

1. Check that templates have `is_active = 1`
2. Verify `metadata.auto_apply = true` for course templates
3. Check logs for errors during submission creation
4. Ensure proper category matching for item workflows

### Lock Not Triggering

1. Verify `final_actions` in template metadata includes:
   ```json
   { "type": "lock_submission", "enabled": true }
   ```
2. Check that all workflow steps are completing successfully
3. Verify `FacultySubmission` model has `is_locked`, `locked_at`, `locked_by` fields

### Performance Issues

1. Consider background processing for workflow creation using queues
2. Add database indexes on frequently queried workflow fields
3. Cache active templates to reduce database queries

## Next Steps

1. **Customize Step Types**: Add domain-specific step types for your reserves process
2. **Add Notifications**: Implement email/SMS notifications for workflow events
3. **Build Reporting**: Create dashboards showing workflow metrics and bottlenecks
4. **Advanced Routing**: Implement more sophisticated condition evaluation for complex workflows
5. **Integration**: Connect workflows to external systems (ILS, LMS, copyright clearance, etc.)

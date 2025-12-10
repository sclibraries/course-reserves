# Workflow Go Back Implementation Guide

## Backend Implementation

### 1. Add goBack() Method to WorkflowInstance Model

In `app/models/WorkflowInstance.php`, add this method:

```php
/**
 * Go back to the previous step in the workflow
 * Works for both in_progress and completed workflows
 * @param string $reason Optional reason for going back
 * @return bool
 * @throws \Exception if there's no previous step to go back to
 */
public function goBack($reason = '')
{
    if ($this->status === 'not_started') {
        throw new \Exception('Cannot go back - workflow has not started yet');
    }

    // Determine which step we're currently on or just completed
    $currentStepId = $this->current_step_id;

    // If workflow is completed and no current step, find the last completed step
    if (!$currentStepId && $this->status === 'completed') {
        $lastCompleted = WorkflowStepHistory::find()
            ->where(['instance_id' => $this->id, 'status' => 'completed'])
            ->orderBy(['created_at' => SORT_DESC])
            ->one();

        if ($lastCompleted) {
            $currentStepId = $lastCompleted->step_id;
        }
    }

    if (!$currentStepId) {
        throw new \Exception('Cannot determine current step');
    }

    // Find the previous step by getting completed steps before the current one
    $previousStepHistory = WorkflowStepHistory::find()
        ->where([
            'instance_id' => $this->id,
            'status' => 'completed'
        ])
        ->andWhere(['!=', 'step_id', $currentStepId])
        ->orderBy(['created_at' => SORT_DESC])
        ->one();

    // If no previous completed step, go to the first step of the template
    if (!$previousStepHistory) {
        $firstStep = WorkflowStep::find()
            ->where(['template_id' => $this->template_id])
            ->orderBy(['step_order' => SORT_ASC])
            ->one();

        if (!$firstStep) {
            throw new \Exception('No steps found in template');
        }

        $previousStep = $firstStep;
    } else {
        $previousStep = $previousStepHistory->step;
        if (!$previousStep) {
            throw new \Exception('Previous step not found');
        }
    }

    $transaction = Yii::$app->db->beginTransaction();
    try {
        // Record the reversion in history
        $revertHistory = new WorkflowStepHistory();
        $revertHistory->instance_id = $this->id;
        $revertHistory->step_id = $this->current_step_id;
        $revertHistory->step_name = $this->current_step_name;
        $revertHistory->status = 'reverted';
        $revertHistory->notes = $reason ?: 'Moved back to previous step';
        $revertHistory->created_by = Yii::$app->user->id ?? null;
        $revertHistory->save(false);

        // Update the instance to point to the previous step
        $this->current_step_id = $previousStep->id;
        $this->current_step_name = $previousStep->step_name;
        $this->status = 'in_progress'; // Reset to in_progress (important for completed workflows)
        $this->completed_at = null; // Clear completion date if it was completed

        // Calculate new progress - count unique completed steps that come BEFORE the current step
        $totalSteps = WorkflowStep::find()
            ->where(['template_id' => $this->template_id])
            ->count();

        // Get the step order of the step we're going back to
        $currentStepOrder = $previousStep->step_order;

        // Count completed steps that have a lower step_order than our current step
        // This gives us accurate progress: if going back to step 1, progress is 0%
        $completedStepIds = WorkflowStepHistory::find()
            ->select('step_id')
            ->where([
                'instance_id' => $this->id,
                'status' => 'completed'
            ])
            ->distinct()
            ->column();

        $completedSteps = WorkflowStep::find()
            ->where([
                'id' => $completedStepIds,
                'template_id' => $this->template_id
            ])
            ->andWhere(['<', 'step_order', $currentStepOrder])
            ->count();

        $this->progress_percentage = $totalSteps > 0 ? round(($completedSteps / $totalSteps) * 100) : 0;
        $this->save(false);

        // Log restart of the previous step
        $restartHistory = new WorkflowStepHistory();
        $restartHistory->instance_id = $this->id;
        $restartHistory->step_id = $previousStep->id;
        $restartHistory->step_name = $previousStep->step_name;
        $restartHistory->status = 'started';
        $restartHistory->notes = 'Restarted after going back';
        $restartHistory->created_by = Yii::$app->user->id ?? null;
        $restartHistory->save(false);

        $transaction->commit();
        return true;
    } catch (\Exception $e) {
        $transaction->rollBack();
        throw $e;
    }
}
```

### 2. Add actionGoBack to WorkflowAdminController

In `app/controllers/WorkflowAdminController.php`, add this action:

```php
/**
 * Go back to the previous step
 * POST /workflow-admin/instance/{id}/go-back
 */
public function actionGoBack($id)
{
    $instance = $this->findInstance($id);

    // Get the reason from POST body
    // Note: Yii2 automatically parses JSON Content-Type requests
    $data = Yii::$app->request->post();
    $reason = $data['reason'] ?? '';

    // Debug logging (remove in production)
    Yii::info('Go back request - Instance ID: ' . $id . ', Reason: ' . $reason, 'workflow');

    try {
        $instance->goBack($reason);

        // Refresh to get updated data
        $instance->refresh();

        return [
            'success' => true,
            'message' => 'Moved back to step: ' . $instance->current_step_name,
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
```

**Important Notes:**

- Yii2 automatically parses JSON requests when `Content-Type: application/json` is set
- Use `Yii::$app->request->post()` to get the full POST body as an array
- The `$data['reason']` will be empty string if not provided (safe default)

### 3. Add Route Configuration

In your URL rules (typically `config/web.php` or `config/main.php`), ensure the route is configured:

```php
'POST workflow-admin/instance/<id:\d+>/go-back' => 'workflow-admin/go-back',
```

## Frontend Implementation

The frontend changes will be implemented in:

- `src/services/workflowService.js` - Add API method
- `src/components/page-sections/submissions/SubmissionDetail.jsx` - Add UI button and handler

## Testing

After implementation, test with:

```bash
# Start workflow
POST /workflow-admin/instance/8/start

# Complete first step
POST /workflow-admin/instance/8/complete-step
{
  "step_data": {},
  "condition_results": []
}

# Complete workflow (finish last step)
POST /workflow-admin/instance/8/complete-step
{
  "step_data": {},
  "condition_results": []
}

# Go back from completed workflow (reopens it)
POST /workflow-admin/instance/8/go-back
{
  "reason": "Need to correct previous step"
}

# Verify:
# - current_step_id should be back to last step
# - history should show: started -> completed (step 1) -> started (step 2) -> completed (step 2) -> reverted -> started (step 2)
# - progress_percentage should be recalculated
# - status should be "in_progress" (no longer "completed")
# - completed_at should be NULL
```

## Edge Cases Handled

1. **Workflow not started**: Throws error "Cannot go back - workflow has not started yet"
2. **No previous step**: Throws error "No previous step found to go back to" (e.g., already on first step)
3. **Completed workflow**: ✅ Reopens the workflow, resets status to "in_progress" and clears completed_at
4. **In-progress workflow**: ✅ Moves back to previous step while staying in progress
5. **Transaction safety**: Uses database transaction to ensure atomicity
6. **Progress recalculation**: Accurately calculates progress after reverting
7. **History tracking**: Records both the reversion and restart in history

## Use Cases

- **Completed Workflows**: Admin realizes a mistake after completion, can reopen and fix
- **In-Progress Workflows**: User needs to correct data from a previous step
- **Multi-step Reviews**: Reviewer wants to revisit earlier validation steps

## How "Go Back" Works - Step by Step

### Example: 2-Step Workflow (Check FOLIO → Verify Term)

**Scenario 1: Go back while in progress**

1. Current state: Step 2 "Verify Term" (in_progress)
2. Click "Go Back"
3. Finds last completed step before current: Step 1 "Check FOLIO"
4. Sets current_step to Step 1
5. Progress: 0% (0 steps completed before step 1)
6. Status remains: in_progress

**Scenario 2: Go back from completed workflow**

1. Current state: Workflow completed (current_step_id might be NULL or step 2)
2. Click "Go Back"
3. Finds the last completed step: Step 2 "Verify Term"
4. Looks for completed steps before Step 2: Step 1 "Check FOLIO"
5. Sets current_step to Step 1
6. Progress: 0% (0 steps completed before step 1)
7. Status changes: completed → in_progress

**Scenario 3: Go back multiple times**

1. At Step 2, click "Go Back" → Goes to Step 1, progress 0%
2. Complete Step 1 → Goes to Step 2, progress 50%
3. At Step 2, click "Go Back" again → Goes back to Step 1, progress 0%
4. Can repeat as needed

**Scenario 4: Go back from first step**

1. Current state: Step 1 (in_progress)
2. Click "Go Back"
3. No previous completed steps found
4. Goes to first step in template (Step 1) - essentially restarting it
5. Progress: 0%

## Troubleshooting

### "No payload" or Empty Request Body

If the backend reports no payload or empty POST data:

1. **Check Content-Type**: Ensure the request has `Content-Type: application/json` header
   - The frontend workflowService.js sets this automatically in `apiCall()` method
2. **Check Yii2 Request Parser**: Ensure your Yii2 app is configured to parse JSON:

   ```php
   // In config/web.php or config/main.php
   'request' => [
       'parsers' => [
           'application/json' => 'yii\web\JsonParser',
       ]
   ],
   ```

3. **Debug the Request**: Add logging in the controller:

   ```php
   public function actionGoBack($id)
   {
       $rawBody = Yii::$app->request->getRawBody();
       Yii::info('Raw body: ' . $rawBody, 'workflow');

       $data = Yii::$app->request->post();
       Yii::info('Parsed data: ' . json_encode($data), 'workflow');

       // ... rest of code
   }
   ```

4. **Check Route Configuration**: Verify the route exists:

   ```php
   'POST workflow-admin/instance/<id:\d+>/go-back' => 'workflow-admin/go-back',
   ```

5. **Test with curl**:
   ```bash
   curl -X POST \
     https://libtools2.smith.edu/course-reserves/backend/web/workflow-admin/instance/8/go-back \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer YOUR_TOKEN' \
     -d '{"reason":"Test reason"}'
   ```

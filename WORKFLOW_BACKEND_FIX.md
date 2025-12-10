# Workflow Backend Fix - Reload Instance After Start

## Problem

When calling `POST /workflow-admin/instance/{id}/start`, the backend:

1. Calls `$instance->start()` which updates the database
2. Returns the original `$instance` object WITHOUT reloading it
3. Frontend receives stale data with `status: "not_started"`

## Solution

The `actionStartInstance` method needs to **reload the instance** after calling `start()` to get the updated values from the database.

## Code Fix

In `app/controllers/WorkflowAdminController.php`, update the `actionStartInstance` method:

### Before (Current - BROKEN):

```php
public function actionStartInstance($id)
{
    $instance = $this->findInstance($id);

    try {
        $instance->start();
        return [
            'success' => true,
            'instance' => $this->formatInstance($instance, true)  // ❌ Returns stale data!
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

### After (FIXED):

```php
public function actionStartInstance($id)
{
    $instance = $this->findInstance($id);

    try {
        $instance->start();

        // ✅ CRITICAL: Reload the instance to get updated values from DB
        $instance->refresh();

        // Or alternatively, reload with relations:
        // $instance = $this->findInstance($id);

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
```

## Same Issue in Other Methods

Apply the same fix to these methods:

### actionCompleteStep

```php
public function actionCompleteStep($id)
{
    $instance = $this->findInstance($id);
    $data = Yii::$app->request->post();

    $stepData = $data['step_data'] ?? [];
    $conditionResults = $data['condition_results'] ?? [];

    try {
        $instance->completeStep($stepData, $conditionResults);

        // ✅ Add this line:
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
```

### actionSkipStep

```php
public function actionSkipStep($id)
{
    $instance = $this->findInstance($id);
    $reason = Yii::$app->request->post('reason', '');

    try {
        $instance->skipStep($reason);

        // ✅ Add this line:
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
```

### actionResumeInstance

```php
public function actionResumeInstance($id)
{
    $instance = $this->findInstance($id);

    try {
        $instance->resume();

        // ✅ Add this line:
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
```

## Why This Happens

Yii2 ActiveRecord models maintain their state in memory. When you call methods like `start()`, `completeStep()`, etc., they:

1. Update database directly via SQL
2. Don't automatically update the in-memory object properties

You must explicitly call `refresh()` to reload from the database.

## Alternative: Reload with Relations

If you need to ensure relations are loaded (like `currentStep`), use:

```php
$instance = WorkflowInstance::find()
    ->with(['template', 'currentStep', 'history'])
    ->where(['id' => $id])
    ->one();
```

Instead of just:

```php
$instance->refresh();
```

## Testing

After applying this fix:

1. Create a new workflow instance
2. Call the start endpoint
3. Response should now show:
   - `status: "in_progress"` (not "not_started")
   - `current_step_id: 1` (not null)
   - `current_step_name: "Initial Review"` (not null)
   - `started_at: "2025-11-11 15:30:00"` (not null)
   - `progress_percentage: 10` (not 0)

## Summary

**Add `$instance->refresh();` after EVERY method that modifies workflow state:**

- `start()`
- `completeStep()`
- `skipStep()`
- `resume()`
- `putOnHold()`
- `cancel()`

This ensures the API always returns current data to the frontend.

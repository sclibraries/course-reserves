# Fix: "Object of class Closure could not be converted to string" Error

## Problem

When calling `POST /workflow-admin/instance/7/complete-step`, the backend returns:

```json
{
  "success": false,
  "message": "Object of class Closure could not be converted to string"
}
```

## Common Causes

This error happens when PHP tries to convert a Closure (anonymous function/callback) to a string. Common places this occurs:

### 1. Logging a Closure

```php
// ❌ WRONG
Yii::info("Transition: " . $transition->actions); // if actions contains a closure

// ✅ RIGHT
Yii::info("Transition: " . json_encode($transition->actions));
```

### 2. String Concatenation with Array/Object

```php
// ❌ WRONG
$message = "Data: " . $conditionResults; // if it's an array or object

// ✅ RIGHT
$message = "Data: " . json_encode($conditionResults);
```

### 3. Trying to Echo/Return Complex Types

```php
// ❌ WRONG
echo $stepData; // if it contains closures or complex objects

// ✅ RIGHT
echo json_encode($stepData);
```

## Where to Look in WorkflowInstance::completeStep()

Check your `app/models/WorkflowInstance.php` file's `completeStep()` method for any of these patterns:

```php
public function completeStep($stepData = [], $conditionResults = [], $notes = null)
{
    // Look for any Yii::info(), Yii::error(), or Yii::warning() calls
    // that try to concatenate data directly

    // ❌ BAD:
    Yii::info("Step data: " . $stepData);
    Yii::info("Condition results: " . $conditionResults);

    // ✅ GOOD:
    Yii::info("Step data: " . json_encode($stepData));
    Yii::info("Condition results: " . json_encode($conditionResults));

    // Also check any transition logic:
    // ❌ BAD:
    Yii::info("Executing transition: " . $transition);

    // ✅ GOOD:
    Yii::info("Executing transition ID: " . $transition->id);
}
```

## Quick Fix Pattern

Replace any logging statements in `completeStep()` that look like this:

```php
// BEFORE (causes error)
Yii::info("Processing: " . $variable);
Yii::error("Failed with: " . $data);

// AFTER (fixed)
Yii::info("Processing: " . json_encode($variable));
Yii::error("Failed with: " . json_encode($data));
```

Or use array logging (Yii's preferred way):

```php
// Best practice for Yii2
Yii::info(['Processing step', 'data' => $stepData, 'conditions' => $conditionResults]);
```

## Debugging Steps

1. **Enable error details**: In your `WorkflowAdminController::actionCompleteStep()`, wrap with better error handling:

```php
public function actionCompleteStep($id)
{
    $instance = $this->findInstance($id);
    $data = Yii::$app->request->post();

    $stepData = $data['step_data'] ?? [];
    $conditionResults = $data['condition_results'] ?? [];

    try {
        $instance->completeStep($stepData, $conditionResults);
        $instance->refresh();

        return [
            'success' => true,
            'instance' => $this->formatInstance($instance, true)
        ];
    } catch (\Exception $e) {
        Yii::$app->response->statusCode = 400;

        // ✅ Add detailed error logging
        Yii::error([
            'message' => 'Complete step failed',
            'exception' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ]);

        return [
            'success' => false,
            'message' => $e->getMessage(),
            'file' => $e->getFile(), // Temporary - remove in production
            'line' => $e->getLine(),  // Temporary - remove in production
        ];
    }
}
```

2. **Check your application logs**: Look in `runtime/logs/app.log` for the full stack trace

3. **Share the WorkflowInstance::completeStep() method**: I can pinpoint the exact line causing the issue

## Most Likely Culprit

Based on workflow systems, the issue is probably in transition logic. Check for something like:

```php
// In WorkflowInstance::completeStep() or related methods
foreach ($transitions as $transition) {
    // ❌ This will fail if transition->actions contains closures:
    Yii::info("Executing: " . $transition->actions);

    // ✅ Should be:
    Yii::info("Executing transition ID: " . $transition->id);
}
```

## Need the Actual Code

Please share:

1. `app/models/WorkflowInstance.php` - specifically the `completeStep()` method
2. Or check `runtime/logs/app.log` for the full error with file and line number

This will let me give you the exact fix!

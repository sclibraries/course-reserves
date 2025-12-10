Here are the exact locations to add `$instance->refresh();` in your WorkflowAdminController.php:

## 1. actionStartInstance

```php
public function actionStartInstance($id)
{
    $instance = $this->findInstance($id);

    try {
        $instance->start();

        // ✅ ADD THIS LINE HERE:
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

## 2. actionCompleteStep

```php
public function actionCompleteStep($id)
{
    $instance = $this->findInstance($id);
    $data = Yii::$app->request->post();

    $stepData = $data['step_data'] ?? [];
    $conditionResults = $data['condition_results'] ?? [];

    try {
        $instance->completeStep($stepData, $conditionResults);

        // ✅ ADD THIS LINE HERE:
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

## 3. actionSkipStep

```php
public function actionSkipStep($id)
{
    $instance = $this->findInstance($id);
    $reason = Yii::$app->request->post('reason', '');

    try {
        $instance->skipStep($reason);

        // ✅ ADD THIS LINE HERE:
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

## 4. actionCancelInstance

```php
public function actionCancelInstance($id)
{
    $instance = $this->findInstance($id);
    $reason = Yii::$app->request->post('reason', '');

    if ($instance->cancel($reason)) {
        // ✅ ADD THIS LINE HERE:
        $instance->refresh();

        return ['success' => true];
    } else {
        Yii::$app->response->statusCode = 500;
        return ['success' => false];
    }
}
```

## 5. actionHoldInstance

```php
public function actionHoldInstance($id)
{
    $instance = $this->findInstance($id);
    $reason = Yii::$app->request->post('reason', '');

    if ($instance->putOnHold($reason)) {
        // ✅ ADD THIS LINE HERE:
        $instance->refresh();

        return ['success' => true];
    } else {
        Yii::$app->response->statusCode = 500;
        return ['success' => false];
    }
}
```

## 6. actionResumeInstance

```php
public function actionResumeInstance($id)
{
    $instance = $this->findInstance($id);

    try {
        $instance->resume();

        // ✅ ADD THIS LINE HERE:
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

---

## Pattern to Remember

The pattern is always the same:

1. Call the method that changes state (e.g., `$instance->start()`)
2. Add `$instance->refresh();` on the next line
3. Then return the response with `$this->formatInstance($instance, true)`

The `refresh()` method reloads the model from the database, ensuring all the updated properties (status, current_step_id, started_at, etc.) are included in the response.

# Fix: Backend Not Returning Full Current Step Object

## Problem

The backend returns:

```json
{
  "current_step_id": 17,
  "current_step_name": "Check FOLIO"
}
```

But the frontend needs:

```json
{
  "current_step": {
    "id": 17,
    "name": "Check FOLIO",
    "description": "Verify course exists in FOLIO",
    "step_order": 1,
    "sequence_order": 1,
    "instructions": "..."
    // ... other step fields
  }
}
```

## Solution

In `WorkflowAdminController.php`, update the `formatInstance()` method:

### Current Code (BROKEN):

```php
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
        'current_step_name' => $instance->currentStep->step_name ?? null,  // ❌ Only name
        'status' => $instance->status,
        // ... rest of fields
    ];

    // ...
}
```

### Fixed Code:

```php
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

    // ✅ ADD THIS: Include full current step object
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
            'instructions' => $instance->currentStep->instructions,
            'assigned_role' => $instance->currentStep->assigned_role,
            'estimated_duration_minutes' => $instance->currentStep->estimated_duration_minutes,
            'form_fields' => $instance->currentStep->form_fields,
            'metadata' => $instance->currentStep->metadata,
        ];
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
```

## Quick Copy-Paste Version

Add this block right after the main `$data` array and before the `if ($includeHistory)` block:

```php
// Include full current step object if exists
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
        'instructions' => $instance->currentStep->instructions,
        'assigned_role' => $instance->currentStep->assigned_role,
        'estimated_duration_minutes' => $instance->currentStep->estimated_duration_minutes,
        'form_fields' => $instance->currentStep->form_fields,
        'metadata' => $instance->currentStep->metadata,
    ];
}
```

## Result

After this change, the API will return:

```json
{
  "current_step_id": 17,
  "current_step_name": "Check FOLIO",
  "current_step": {
    "id": 17,
    "name": "Check FOLIO",
    "step_key": "check_folio",
    "description": "Verify course exists in FOLIO",
    "step_order": 1,
    "sequence_order": 1,
    "instructions": "Check if course is properly set up in FOLIO system",
    "is_required": true,
    "is_automated": false,
    "form_fields": [],
    "metadata": {}
  },
  "status": "in_progress",
  ...
}
```

And the UI will show:

- ✅ "Current Step: Check FOLIO"
- ✅ "Step 1" (instead of "Step ?")
- ✅ Step description (if present)
- ✅ Instructions box (if present)
- ✅ "Complete Step" and "Skip Step" buttons

# Workflow Step Data Input Feature

## Overview

The workflow system now supports **required data input** for steps instead of automation. This allows steps like "Verify Course in FOLIO" to collect necessary information (like FOLIO ID) before being marked complete.

## Changes Made

### 1. Removed Automation Logic

- **Removed**: `is_automated` flag and automation handlers
- **Reason**: You want manual control, not automation

### 2. New Checkbox-Style UI

- **Before**: Card-based layout with action buttons
- **After**: Clean checkbox list that shows inline data entry when needed

### 3. New `required_data` Field

Steps can now specify data requirements via a `required_data` JSON field:

```json
{
  "field": "folio_course_id",
  "label": "FOLIO Course ID",
  "type": "text",
  "placeholder": "Enter FOLIO Course ID (e.g., 12345)",
  "description": "The unique identifier for this course in FOLIO",
  "required": true
}
```

## Database Schema Addition

Add `required_data` column to `workflow_template_steps`:

```sql
ALTER TABLE workflow_template_steps
ADD COLUMN required_data JSON DEFAULT NULL
COMMENT 'JSON object defining data input requirements for this step';
```

## Example: FOLIO Course Verification Step

### Template Configuration

```json
{
  "step_name": "Verify Course in FOLIO",
  "step_key": "check_folio_course",
  "step_type": "action",
  "step_order": 1,
  "is_gate": 1,
  "is_required": 1,
  "description": "Confirm that this course exists in FOLIO",
  "instructions": "Enter the FOLIO course ID to verify the course exists in the system.",
  "required_data": {
    "field": "folio_course_id",
    "label": "FOLIO Course ID",
    "type": "text",
    "placeholder": "e.g., 3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "description": "Look up the course in FOLIO and enter its UUID",
    "required": true
  }
}
```

### User Experience

1. Staff member sees unchecked checkbox for "Verify Course in FOLIO"
2. Clicks checkbox → Input field appears inline
3. Enters FOLIO ID: `3fa85f64-5717-4562-b3fc-2c963f66afa6`
4. Clicks "Submit & Complete" (or presses Enter)
5. Step is marked complete, data is saved to backend

### Backend Receives

```json
{
  "notes": "Step 'Verify Course in FOLIO' completed from SubmissionDetail UI",
  "step_data": {
    "folio_course_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
}
```

## Field Types Supported

| Type       | HTML Input              | Use Case                       |
| ---------- | ----------------------- | ------------------------------ |
| `text`     | `<input type="text">`   | IDs, codes, names              |
| `email`    | `<input type="email">`  | Email addresses                |
| `url`      | `<input type="url">`    | Web links                      |
| `number`   | `<input type="number">` | Numeric values                 |
| `date`     | `<input type="date">`   | Date selection                 |
| `textarea` | `<textarea>`            | Long text (future enhancement) |

## UI Behavior

### Visual States

- **Unchecked + No data required**: Click → immediately complete
- **Unchecked + Data required**: Click → show input field
- **Data entry shown**: Enter data → "Submit & Complete" button active
- **Completed**: Checkbox checked, strikethrough text, green background
- **Blocked by dependencies**: Grayed out, tooltip explains why

### Progressive Disclosure

Data entry only appears when:

1. Step is active and actionable
2. User clicks the checkbox
3. Step has `required_data` defined

### Error Handling

- Empty submission: "Please enter FOLIO Course ID before completing this step"
- Invalid format: Browser validation (for email, url, etc.)
- Backend errors: Toast notification with error message

## WorkflowTemplateManager Updates

### Before

- Column: "Automation" showing "Automated" or "Manual"

### After

- Column: "Data Required" showing:
  - Badge with field label (e.g., "FOLIO Course ID") if data required
  - "None" if no data needed

## Migration Path

### Existing Templates

If you have steps with `is_automated=1`:

1. Identify what data they need (if any)
2. Remove `is_automated` and `automation_handler`
3. Add `required_data` if the step needs input
4. Update UI expectations (no auto-completion)

### Example Migration

**Old (automated):**

```json
{
  "step_name": "Validate FOLIO Course",
  "is_automated": 1,
  "automation_handler": "folio_course_validation"
}
```

**New (manual with data):**

```json
{
  "step_name": "Verify Course in FOLIO",
  "is_automated": 0,
  "required_data": {
    "field": "folio_course_id",
    "label": "FOLIO Course ID",
    "type": "text"
  }
}
```

## Backend Implementation Notes

### Endpoint: `POST /workflow-admin/instance/:id/steps/:stepId/complete`

**Request Body:**

```json
{
  "notes": "Step completed from UI",
  "step_data": {
    "folio_course_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
}
```

**Validation:**

1. Check if step has `required_data`
2. If yes, validate that `step_data` contains the required field
3. Optionally validate format/existence (e.g., check FOLIO API)
4. Store `step_data` in instance history or metadata
5. Mark step complete and advance workflow

**Response:**

```json
{
  "success": true,
  "message": "Step completed successfully",
  "step": {
    "id": 1,
    "status": "completed",
    "completed_at": "2025-11-13T10:30:00Z"
  },
  "next_step": {...}
}
```

## Future Enhancements

### Complex Validation

```json
{
  "field": "folio_course_id",
  "label": "FOLIO Course ID",
  "type": "text",
  "validation": {
    "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    "message": "Must be a valid UUID"
  },
  "api_validation": {
    "endpoint": "/folio/courses/:value/exists",
    "message": "Course not found in FOLIO"
  }
}
```

### Multiple Fields

```json
{
  "fields": [
    { "field": "folio_course_id", "label": "FOLIO Course ID", "type": "text" },
    { "field": "start_date", "label": "Start Date", "type": "date" }
  ]
}
```

### Conditional Fields

```json
{
  "field": "location",
  "label": "Location",
  "type": "select",
  "options": ["Main Library", "Branch", "Online"],
  "conditional_fields": {
    "Branch": [
      { "field": "branch_name", "label": "Branch Name", "type": "text" }
    ]
  }
}
```

## Testing Checklist

- [ ] Step without `required_data`: Click checkbox → immediately completes
- [ ] Step with `required_data`: Click checkbox → shows input field
- [ ] Data entry: Enter value → Submit → step completes
- [ ] Data entry: Empty value → Submit → shows warning
- [ ] Data entry: Cancel → input closes, checkbox unchecked
- [ ] Data entry: Enter key → same as Submit button
- [ ] Completed step: Checkbox checked, strikethrough, green background
- [ ] Blocked step: Disabled, tooltip explains why
- [ ] Template manager: Shows "Data Required" column correctly
- [ ] Backend: Receives `step_data` in completion payload

## Questions?

This design gives you full manual control while still collecting structured data. The checkbox UI is clearer than buttons, and the inline data entry keeps staff in flow without modal popups.

Let me know if you need adjustments to field types, validation, or UI behavior!

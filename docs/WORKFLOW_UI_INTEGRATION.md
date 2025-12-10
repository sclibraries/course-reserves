# Workflow UI Integration - Submission Detail

## Overview

Added workflow template application functionality to the `SubmissionDetail.jsx` component, allowing admins to view existing workflows and manually apply workflow templates to submissions.

## Changes Made

### 1. Import Added

```javascript
import { workflowService } from "../../../services/admin/workflowService";
```

### 2. New State Variables

- `courseWorkflow` - Stores the active course workflow instance for this submission
- `workflowsLoading` - Loading state for workflow operations
- `availableTemplates` - List of active course workflow templates that can be applied

### 3. New Functions

#### `loadWorkflowStatus(submissionId)`

- Fetches existing workflow instances for the submission
- Displays current workflow status if one exists
- Called on component mount

#### `loadAvailableTemplates()`

- Fetches all active course workflow templates
- Shows available templates that can be applied
- Filters to only `workflow_type: 'course'` and `is_active: true`

#### `handleApplyWorkflow(templateId)`

- Creates a new workflow instance from the selected template
- Automatically starts the workflow
- Refreshes the workflow status display
- Shows success/error toast notifications

### 4. New UI Section - "Course Workflow"

Added between the Header Card and Statistics section:

**When Workflow Exists:**

- Shows workflow template name
- Displays current status badge (completed, in_progress, on_hold, etc.)
- Shows current step name
- Displays progress bar with percentage

**When No Workflow:**

- Shows info alert explaining no workflow is applied
- Lists available workflow templates as buttons
- Click button to apply and start workflow
- Shows helper text about workflow behavior

## Usage

### For Existing Submissions Without Workflows

1. Navigate to submission detail: `/admin/submission/:submissionId`
2. See "Course Workflow" card with "No workflow has been applied" message
3. Click one of the template buttons (e.g., "Standard Course Processing")
4. Workflow is created and automatically started
5. Status updates to show progress

### For Submissions With Workflows

1. Navigate to submission detail
2. See "Course Workflow" card showing:
   - Template name
   - Current status
   - Current step
   - Progress percentage
3. Progress bar visually indicates completion

## Backend Requirements

Workflows will be automatically created for NEW submissions if:

1. Backend implements auto-creation logic from `WORKFLOW_INTEGRATION_GUIDE.md`
2. Course workflow template has `auto_apply: true` in metadata
3. Template is active (`is_active: 1`)

For EXISTING submissions without workflows:

- Use the manual UI to apply templates
- This integration fills the gap for legacy data

## API Calls Made

1. **GET** `/workflow-admin/instances?entity_type=course&submission_id=X`
   - Check for existing workflow
2. **GET** `/workflow-admin/templates?type=course&active=true`
   - Load available templates
3. **POST** `/workflow-admin/instances`

   - Create new workflow instance

   ```json
   {
     "template_id": 1,
     "entity_type": "course",
     "entity_id": "submission-uuid",
     "submission_id": "submission-uuid",
     "priority": "normal",
     "workflow_data": {
       "course_code": "CS101",
       "faculty_name": "Dr. Smith",
       "term": "Spring 2025"
     }
   }
   ```

4. **POST** `/workflow-admin/instances/:id/start`
   - Start the workflow

## Next Steps

1. **Load Preset Templates**: Run the SQL migration to create default templates

   ```bash
   mysql -u user -p database < db/migrations/workflow_templates_course_presets.sql
   ```

2. **Test Manual Application**:

   - Go to any submission detail
   - Apply a workflow template
   - Verify status updates

3. **Implement Auto-Creation**: Follow `WORKFLOW_INTEGRATION_GUIDE.md` to add auto-creation in `FacultySubmissionController.php`

4. **Add Item Workflows**: Similar integration could be added at the individual item level (future enhancement)

## Visual Indicators

The workflow section uses Bootstrap color coding:

- **Success (Green)**: Completed workflows
- **Info (Blue)**: In progress workflows
- **Warning (Yellow)**: On hold workflows
- **Secondary (Gray)**: Not started workflows
- **Danger (Red)**: Cancelled workflows

## Related Files

- `/src/components/page-sections/admin/SubmissionDetail.jsx` - Main component
- `/src/services/admin/workflowService.js` - API service
- `/docs/WORKFLOW_INTEGRATION_GUIDE.md` - Backend integration guide
- `/db/migrations/workflow_templates_course_presets.sql` - Default templates

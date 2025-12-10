# Workflow System Bug Fixes

## Issues Fixed

### Issue 1: Undefined Instance ID in Start Workflow Call

**Problem**:

- Request URL was `https://libtools2.smith.edu/course-reserves/backend/web/workflow-admin/instance/undefined/start`
- `instance.id` was undefined when calling `startWorkflow()`

**Root Cause**:

- Backend returns response as `{ success: true, instance: {...} }`
- Frontend was directly using `response` assuming it was the instance object
- Should extract `response.instance` or fall back to `response`

**Fixed In**:

1. `src/components/page-sections/admin/SubmissionDetail.jsx` - `handleApplyWorkflow()`
2. `src/services/admin/workflowService.js` - `autoCreateWorkflow()`

**Solution**:

```javascript
// Before
const instance = await workflowService.createInstance({...});
await workflowService.startWorkflow(instance.id); // undefined!

// After
const response = await workflowService.createInstance({...});
const instance = response.instance || response; // Handle both structures

if (!instance || !instance.id) {
  throw new Error('Invalid response from server - missing instance ID');
}

await workflowService.startWorkflow(instance.id); // Works!
```

---

### Issue 2: Data Integrity Errors When Deleting Templates

**Problem**:

- Backend threw data integrity errors when trying to DELETE templates
- Templates referenced by workflow instances cannot be hard-deleted

**Root Cause**:

- Using `DELETE /workflow-admin/template/:id` endpoint
- Backend has foreign key constraints preventing deletion
- Should use archive endpoint instead

**Fixed In**:

1. `src/config/api.config.js` - Added `archiveTemplate` endpoint
2. `src/services/admin/workflowService.js` - Changed to use POST to archive endpoint
3. `src/components/page-sections/admin/WorkflowTemplateManager.jsx` - Updated messaging
4. `src/components/page-sections/admin/workflow-builder/WorkflowTemplateEditor.jsx` - Updated to archive

**Solution**:

```javascript
// api.config.js - Added endpoint
archiveTemplate: '/workflow-admin/template/:id/archive',

// workflowService.js - Changed method
async deleteTemplate(id) {
  const url = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.workflow.archiveTemplate.replace(':id', id)}`;
  return await this.apiCall(url, 'POST'); // POST not DELETE
}
```

**Backend Behavior**:

```php
// Sets is_active = 0 instead of deleting
$template->is_active = 0;
$template->save(false);
```

---

### Issue 3: Hardcoded Localhost URLs in WorkflowTemplateEditor

**Problem**:

- Edit template made request to `/api/workflow-admin/templates/:id`
- Delete template made request to `/api/workflow-admin/templates/:id`
- These are relative URLs that don't use the proper base URL from config

**Root Cause**:

- Hardcoded URLs instead of using `apiConfig`
- Missing authorization headers

**Fixed In**:

- `src/components/page-sections/admin/workflow-builder/WorkflowTemplateEditor.jsx`

**Solution**:

```javascript
// Before
const response = await fetch(`/api/workflow-admin/templates/${id}`);

// After
const url = `${
  apiConfig.urls.courseReserves
}${apiConfig.endpoints.workflow.getTemplate.replace(":id", id)}`;
const response = await fetch(url, {
  headers: {
    Authorization: apiConfig.getAuthToken(),
    "Content-Type": "application/json",
  },
});
```

**Affected Methods**:

1. `loadTemplate()` - GET template
2. `handleDelete()` - Archive template

---

## Changes Summary

### Files Modified

1. **src/config/api.config.js**

   - Added `archiveTemplate: '/workflow-admin/template/:id/archive'` endpoint

2. **src/services/admin/workflowService.js**

   - Updated `deleteTemplate()` to use archive endpoint with POST
   - Added `archiveTemplate()` alias method
   - Fixed `autoCreateWorkflow()` to handle nested response structure

3. **src/components/page-sections/admin/SubmissionDetail.jsx**

   - Fixed `handleApplyWorkflow()` to extract instance from response
   - Added validation for instance.id before calling startWorkflow
   - Added console.log for debugging response structure

4. **src/components/page-sections/admin/WorkflowTemplateManager.jsx**

   - Updated delete confirmation message to say "archive"
   - Updated toast messages to say "archived"

5. **src/components/page-sections/admin/workflow-builder/WorkflowTemplateEditor.jsx**
   - Fixed `loadTemplate()` to use apiConfig URLs and auth headers
   - Fixed `handleDelete()` to use apiConfig URLs and auth headers
   - Changed to use archive endpoint (POST)
   - Updated confirmation dialog to say "archive"

---

## Testing Checklist

- [x] Apply workflow template to submission - instance.id is defined
- [x] Start workflow successfully - no undefined in URL
- [x] Archive template - uses correct endpoint without data integrity errors
- [x] Edit template - loads from correct API endpoint
- [x] All requests use proper base URL from apiConfig
- [x] Authorization headers included in all requests

---

## API Endpoint Reference

### Template Endpoints

- **List**: `GET /workflow-admin/templates`
- **Get**: `GET /workflow-admin/template/:id`
- **Create**: `POST /workflow-admin/templates`
- **Update**: `PUT /workflow-admin/template/:id`
- **Archive**: `POST /workflow-admin/template/:id/archive` ✨ (sets is_active=0)
- **Duplicate**: `POST /workflow-admin/template/:id/duplicate`

### Instance Endpoints

- **List**: `GET /workflow-admin/instances`
- **Get**: `GET /workflow-admin/instance/:id`
- **Create**: `POST /workflow-admin/instances`
- **Start**: `POST /workflow-admin/instance/:id/start` ✨
- **Complete Step**: `POST /workflow-admin/instance/:id/complete-step`
- **Cancel**: `POST /workflow-admin/instance/:id/cancel`

---

## Response Structures

### Create Instance Response

```json
{
  "success": true,
  "instance": {
    "id": 123,
    "template_id": 5,
    "entity_type": "course",
    "entity_id": "abc-123",
    "status": "not_started",
    ...
  }
}
```

### Archive Template Response

```json
{
  "success": true,
  "message": "Template archived successfully",
  "template": {
    "id": 5,
    "name": "Standard Course Processing",
    "is_active": 0,
    ...
  }
}
```

---

## Notes

- All workflow template "delete" operations now archive instead of hard delete
- Archived templates have `is_active = 0` but remain in database
- Frontend consistently uses `apiConfig` for all API calls
- Response handling is defensive with fallbacks for different structures
- Authorization headers properly included in all requests

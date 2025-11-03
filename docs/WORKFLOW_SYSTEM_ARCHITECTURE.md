# Workflow System Architecture

## Overview
The workflow system provides customizable checklists for processing course reserves submissions and resources. It supports both course-level and resource-level workflows with progress tracking and step-specific communication.

## Current Implementation (Phase 1 - Frontend Only)

### Components
- **WorkflowPanel.jsx**: Main workflow UI component
  - Displays course and resource workflows
  - Shows progress bars and completion status
  - Allows checking/unchecking steps
  - Collapsible sections for better UX

### Features Implemented
✅ Two-level workflow system (course + resource)
✅ Material-type specific workflows (book, article, video, default)
✅ Progress tracking and visualization
✅ Step completion tracking
✅ Collapsible workflow sections
✅ Badge indicators in channel list
✅ Responsive design

### Mock Data Structure
Currently using hardcoded templates in `WORKFLOW_TEMPLATES` constant:
```javascript
{
  course: [...],      // Course-level steps
  book: [...],        // Book-specific steps
  article: [...],     // Article-specific steps
  video: [...],       // Video-specific steps
  default: [...]      // Fallback for unknown types
}
```

Each step includes:
- `id`: Unique identifier
- `title`: Step description
- `required`: Whether step is mandatory
- `decision`: Whether step is a decision point (future use)
- `conditional`: Conditional logic (future use)

---

## Backend Implementation Guide (Phase 2)

### Database Schema

#### 1. Workflow Templates
Stores reusable workflow templates.

```sql
CREATE TABLE workflow_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  type ENUM('course', 'resource') NOT NULL,
  material_type VARCHAR(100) NULL,  -- NULL for course templates
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  steps JSON NOT NULL,              -- Array of step definitions
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_type_material (type, material_type),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**steps JSON structure:**
```json
[
  {
    "id": "step_1",
    "title": "Check if we own the book",
    "description": "Search catalog to verify ownership",
    "order": 1,
    "required": true,
    "type": "checkbox",
    "decision": true,
    "conditional": null,
    "action_trigger": null
  },
  {
    "id": "step_2",
    "title": "Send acquisition request",
    "order": 2,
    "required": true,
    "type": "checkbox",
    "conditional": "step_1:no",
    "action_trigger": "create_acquisition_request"
  }
]
```

#### 2. Workflow Instances
Tracks active workflows for submissions/resources.

```sql
CREATE TABLE workflow_instances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL,
  submission_id INT NULL,           -- For course-level workflows
  resource_id INT NULL,              -- For resource-level workflows
  current_step VARCHAR(50),
  status ENUM('not_started', 'in_progress', 'completed', 'blocked') DEFAULT 'not_started',
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_submission (submission_id),
  INDEX idx_resource (resource_id),
  INDEX idx_status (status),
  FOREIGN KEY (template_id) REFERENCES workflow_templates(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  
  -- Ensure either submission_id or resource_id is set, not both
  CHECK ((submission_id IS NOT NULL AND resource_id IS NULL) OR 
         (submission_id IS NULL AND resource_id IS NOT NULL))
);
```

#### 3. Workflow Step Completions
Records individual step completions.

```sql
CREATE TABLE workflow_step_completions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  instance_id INT NOT NULL,
  step_id VARCHAR(50) NOT NULL,     -- References step ID in template
  completed BOOLEAN DEFAULT FALSE,
  completed_by INT NULL,
  completed_at TIMESTAMP NULL,
  notes TEXT,
  decision_value VARCHAR(50) NULL,   -- For decision steps (yes/no/other)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_instance_step (instance_id, step_id),
  INDEX idx_instance (instance_id),
  INDEX idx_completed (completed),
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id)
);
```

#### 4. Workflow Communications (Optional)
Links workflow steps to communications.

```sql
CREATE TABLE workflow_step_communications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  step_completion_id INT NOT NULL,
  communication_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_step (step_completion_id),
  INDEX idx_communication (communication_id),
  FOREIGN KEY (step_completion_id) REFERENCES workflow_step_completions(id) ON DELETE CASCADE,
  FOREIGN KEY (communication_id) REFERENCES communications(id) ON DELETE CASCADE
);
```

### API Endpoints

#### Get Workflow for Item
```
GET /api/workflow/instance?submission_id={id}&resource_id={id}
```

**Response:**
```json
{
  "course_workflow": {
    "instance_id": 123,
    "template_id": 1,
    "template_name": "Standard Course Setup",
    "status": "in_progress",
    "progress_percentage": 50.0,
    "steps": [
      {
        "id": "c1",
        "title": "Verify course exists in Folio",
        "order": 1,
        "required": true,
        "completed": true,
        "completed_by": "John Doe",
        "completed_at": "2025-10-28T10:30:00Z",
        "notes": "Course verified in Folio"
      },
      {
        "id": "c2",
        "title": "Check if reactivating existing course",
        "order": 2,
        "required": true,
        "completed": false,
        "completed_by": null,
        "completed_at": null,
        "notes": null
      }
    ]
  },
  "resource_workflow": {
    "instance_id": 456,
    "template_id": 5,
    "template_name": "Book Processing",
    "status": "in_progress",
    "progress_percentage": 28.57,
    "steps": [...]
  }
}
```

#### Update Workflow Step
```
POST /api/workflow/step/complete
```

**Request:**
```json
{
  "instance_id": 123,
  "step_id": "c1",
  "completed": true,
  "notes": "Course verified in Folio",
  "decision_value": null
}
```

**Response:**
```json
{
  "success": true,
  "instance": {
    "id": 123,
    "progress_percentage": 50.0,
    "status": "in_progress"
  }
}
```

#### Get Workflow Templates (Admin)
```
GET /api/admin/workflow/templates?type=resource&material_type=book
```

#### Create/Update Workflow Template (Admin)
```
POST /api/admin/workflow/templates
PUT /api/admin/workflow/templates/{id}
```

---

## Phase 3: Admin Template Builder

### Features
- Drag-and-drop step reordering
- Add/edit/delete steps
- Conditional logic builder (if/then)
- Action triggers (send to acquisitions, notify faculty, etc.)
- Clone existing templates
- Preview workflows
- Material type assignment

### UI Components
- **WorkflowTemplateList**: Browse and manage templates
- **WorkflowTemplateEditor**: Visual workflow builder
- **StepEditor**: Edit individual step properties
- **ConditionalLogicBuilder**: Define if/then rules

---

## Integration Points

### 1. Automatic Workflow Creation
When a new submission/resource enters the work queue:
```javascript
// Trigger workflow instance creation
POST /api/workflow/initialize
{
  "submission_id": 28,
  "resource_id": 369,
  "material_type": "book"
}
```

### 2. Communication Integration
Link workflow steps to communications:
- Acquisitions step → Create acquisition communication
- Faculty notification step → Send faculty message
- Staff coordination step → Create staff communication

### 3. Status Updates
Workflow completion should update submission/resource status:
- All required steps complete → Mark as "Ready for Faculty"
- Blocked on acquisition → Mark as "Pending Acquisition"

### 4. Notifications
Send notifications when:
- Workflow step completed by someone else
- Workflow blocked (missing required action)
- Workflow fully completed

---

## State Management (Frontend)

### Current Approach (Phase 1)
Using local component state in WorkflowPanel.

### Future Approach (Phase 2+)
Consider adding to Zustand store:

```javascript
// workflowStore.js
const useWorkflowStore = create((set) => ({
  workflows: {},
  
  loadWorkflow: async (submissionId, resourceId) => {
    const data = await workflowService.getWorkflow(submissionId, resourceId);
    set(state => ({
      workflows: {
        ...state.workflows,
        [`${submissionId}-${resourceId}`]: data
      }
    }));
  },
  
  updateStep: async (instanceId, stepId, completed, notes) => {
    await workflowService.updateStep(instanceId, stepId, completed, notes);
    // Refresh workflow data
  }
}));
```

---

## Testing Considerations

### Phase 1 (Current)
- ✅ UI renders correctly with mock data
- ✅ Steps can be checked/unchecked
- ✅ Progress bars update correctly
- ✅ Collapsible sections work
- ✅ Material type determines correct workflow

### Phase 2 (Backend Integration)
- [ ] Workflow instance created on item assignment
- [ ] Steps persist to database
- [ ] Progress calculates correctly
- [ ] Multiple users see same workflow state
- [ ] Completion timestamps recorded accurately

### Phase 3 (Admin Builder)
- [ ] Templates can be created/edited
- [ ] Steps can be reordered
- [ ] Conditional logic evaluates correctly
- [ ] Action triggers fire appropriately
- [ ] Templates can be assigned to material types

---

## Performance Considerations

1. **Caching**: Cache workflow templates (they change infrequently)
2. **Lazy Loading**: Load workflow data only when workflow channel is selected
3. **Optimistic Updates**: Update UI immediately, sync with backend
4. **Batch Updates**: If multiple steps completed, batch the API calls

---

## Future Enhancements

1. **Workflow Analytics**
   - Average time per step
   - Bottleneck identification
   - Completion rates by material type

2. **Workflow Templates Marketplace**
   - Share templates between institutions
   - Import/export templates

3. **Smart Workflows**
   - AI-suggested next steps
   - Auto-complete certain steps based on data (e.g., "We own this book" if found in catalog)

4. **Workflow Branching**
   - Complex conditional logic
   - Parallel step execution
   - Sub-workflows

5. **Role-Based Steps**
   - Assign specific steps to specific roles (acquisitions, cataloging, etc.)
   - Step-level permissions

---

## Migration Path

### From Phase 1 to Phase 2

1. Create database tables
2. Seed with current hardcoded templates
3. Update WorkflowPanel to call API instead of using mock data
4. Add API endpoints
5. Test with existing UI

### From Phase 2 to Phase 3

1. Build admin UI components
2. Add template CRUD endpoints
3. Migrate to new template format
4. Add template version control
5. Train staff on template builder

---

## Questions for Backend Implementation

1. **Workflow Reactivation**: If reusing a course from previous semester, should we:
   - Clone the old workflow instance?
   - Start fresh workflow?
   - Mark old workflow as "reactivated"?

2. **Partial Completion**: If a workflow is 50% done and item is unclaimed:
   - Keep progress?
   - Reset workflow?
   - Configurable per template?

3. **Workflow Modification**: If template changes while instance is active:
   - Keep old template steps?
   - Migrate to new template?
   - Show warning?

4. **Permissions**: Who can:
   - Complete steps? (Everyone, assigned user only, role-based)
   - Modify workflows? (Admins only, supervisors, everyone)
   - Create templates? (Admins only)

5. **Archiving**: When to archive completed workflows?
   - After X days?
   - After semester ends?
   - Never (keep for analytics)?

---

## Contact
For questions about implementation, contact the development team.

**Last Updated**: October 28, 2025
**Phase**: 1 (Frontend UI Only)
**Next Phase**: Backend API + Database Implementation

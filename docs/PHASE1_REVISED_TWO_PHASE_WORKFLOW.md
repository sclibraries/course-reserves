# Phase 1 Revised - Two-Phase Workflow System

## Overview

Implementing a two-phase workflow where staff must claim items before they can work on them.

---

## User Experience Flow

### Current View Problems:
- All workflow actions available immediately
- No clear ownership before starting work
- Confusing when multiple staff viewing same submission

### New Flow:

```
┌─────────────────────────────────────────────────────────────┐
│  1. SUBMISSIONS QUEUE (Browse & Claim)                      │
│                                                              │
│  Purpose: See what needs to be done, claim items            │
│  Actions: View, Claim                                        │
│  Can't: Change status, message, modify                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [User clicks "Claim"]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. MY WORK QUEUE (Process)                                 │
│                                                              │
│  Purpose: Work on claimed items with full tools             │
│  Actions: Everything - status, messaging, handoffs, tasks   │
│  Items: Only shows items YOU claimed                        │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Structure

### Tab Navigation in Admin Page

```jsx
<Tabs>
  <Tab id="submissions">
    📥 Submissions Queue (12)
    {/* All pending submissions - browse and claim */}
  </Tab>
  
  <Tab id="my-work">
    ⚙️ My Work Queue (5)
    {/* Only items I've claimed - full workflow tools */}
  </Tab>
  
  <Tab id="all-work">
    👥 All Work (optional)
    {/* See what everyone is working on */}
  </Tab>
</Tabs>
```

---

## Component 1: Submissions Queue (Browse Mode)

**Purpose:** Browse submissions, see what needs work, claim items

**UI - Simplified Item Card:**
```jsx
<ItemCard mode="browse">
  <ItemHeader>
    <DisplayNumber>1.1</DisplayNumber>
    <ItemTitle>Book Title</ItemTitle>
    
    {/* Claim status - READ ONLY */}
    {!item.claimedBy ? (
      <Badge color="secondary">Unclaimed</Badge>
    ) : (
      <Badge color="info">
        Claimed by {item.claimedBy.name}
      </Badge>
    )}
  </ItemHeader>
  
  <ItemInfo>
    <MaterialType>Physical Book</MaterialType>
    <BasicMetadata>
      Barcode: 123456
      Call Number: QH510 .B4
    </BasicMetadata>
    {item.facultyNotes && (
      <FacultyNotes>{item.facultyNotes}</FacultyNotes>
    )}
  </ItemInfo>
  
  <ItemActions>
    {!item.claimedBy ? (
      <Button color="primary" onClick={handleClaim}>
        <FaHandPointRight /> Claim This Item
      </Button>
    ) : item.claimedBy.id === currentUser.id ? (
      <Button color="success" onClick={goToMyWork}>
        <FaCog /> Work on This
      </Button>
    ) : (
      <Badge color="secondary">
        Being handled by {item.claimedBy.name}
      </Badge>
    )}
  </ItemActions>
</ItemCard>
```

**Key Features:**
- ✅ Can view all items
- ✅ Can see who claimed items
- ✅ Can claim unclaimed items
- ✅ Quick link to work on your claimed items
- ❌ Cannot change status
- ❌ Cannot send messages
- ❌ Cannot modify anything

---

## Component 2: My Work Queue (Work Mode)

**Purpose:** Process items you've claimed with full workflow tools

**UI - Full Workflow Item Card:**
```jsx
<ItemCard mode="work">
  <ItemHeader>
    <DisplayNumber>1.1</DisplayNumber>
    <ItemTitle>Book Title</ItemTitle>
    
    {/* Ownership indicator */}
    <Badge color="success">
      <FaUser /> You're working on this
    </Badge>
    
    {/* Current Status */}
    <StatusDropdown 
      status={item.status}
      onChange={handleStatusChange}
    />
  </ItemHeader>
  
  <ItemInfo>
    <MaterialType>Physical Book</MaterialType>
    <FullMetadata>...</FullMetadata>
  </ItemInfo>
  
  {/* Workflow Tasks Checklist */}
  <WorkflowTasks>
    <TaskChecklist materialType={item.materialType}>
      {/* Dynamic based on material type */}
      <Task completed={item.tasks.catalogCheck}>
        ☐ Check catalog for availability
      </Task>
      <Task completed={item.tasks.itemLocated}>
        ☐ Locate physical item
      </Task>
      <Task completed={item.tasks.placeOnReserve}>
        ☐ Place on reserve desk
      </Task>
    </TaskChecklist>
  </WorkflowTasks>
  
  {/* Action Buttons */}
  <ActionBar>
    <ButtonGroup label="Communication">
      <Button onClick={openFacultyMessage}>
        <FaEnvelope /> Message Faculty
      </Button>
      <Button onClick={openStaffMessage}>
        <FaComment /> Message Staff
      </Button>
    </ButtonGroup>
    
    <ButtonGroup label="Handoffs">
      <Button color="warning" onClick={sendToAcquisitions}>
        <FaShoppingCart /> Send to Acquisitions
      </Button>
      <Button color="info" onClick={sendToILL}>
        <FaBook /> Send to ILL
      </Button>
    </ButtonGroup>
    
    <ButtonGroup label="Item Actions">
      <Button onClick={openNotesModal}>
        <FaStickyNote /> Add Notes
      </Button>
      <Button color="secondary" onClick={handleRelease}>
        <FaTimes /> Release Item
      </Button>
      <Button color="success" onClick={handleComplete}>
        <FaCheckCircle /> Mark Complete
      </Button>
    </ButtonGroup>
  </ActionBar>
  
  {/* Activity History */}
  <ActivityLog>
    <LogEntry>
      <Avatar user={user} />
      Claimed by Jane Smith - 2 hours ago
    </LogEntry>
    <LogEntry>
      Status changed: pending → in_progress
    </LogEntry>
    <LogEntry>
      Task completed: Check catalog ✓
    </LogEntry>
  </ActivityLog>
</ItemCard>
```

**Key Features:**
- ✅ Full workflow tools
- ✅ Task checklist (material-type specific)
- ✅ Messaging (faculty & staff)
- ✅ Status changes
- ✅ Department handoffs
- ✅ Notes and history
- ✅ Can release item back to queue

---

## Workflow Tasks System

### Task Definitions by Material Type

```javascript
const WORKFLOW_TASKS = {
  PHYSICAL_BOOK: [
    { id: 'catalog_check', label: 'Check catalog for item', required: true },
    { id: 'item_located', label: 'Locate physical item', required: true },
    { id: 'condition_check', label: 'Check item condition', required: false },
    { id: 'place_reserve', label: 'Place on reserve desk', required: true },
    { id: 'notify_faculty', label: 'Notify faculty item is ready', required: true }
  ],
  
  ELECTRONIC_ARTICLE: [
    { id: 'access_check', label: 'Verify we have access', required: true },
    { id: 'find_link', label: 'Get persistent link', required: true },
    { id: 'copyright_check', label: 'Verify copyright compliance', required: false },
    { id: 'add_to_course', label: 'Add to course page', required: true },
    { id: 'test_link', label: 'Test link works', required: true }
  ],
  
  VIDEO_DVD: [
    { id: 'catalog_check', label: 'Check if we own DVD', required: true },
    { id: 'panopto_check', label: 'Check Panopto for streaming version', required: true },
    { id: 'digitize_request', label: 'Request digitization if needed', required: false },
    { id: 'streaming_setup', label: 'Set up streaming access', required: true },
    { id: 'test_access', label: 'Test student access', required: true }
  ],
  
  STREAMING_VIDEO: [
    { id: 'subscription_check', label: 'Check our subscriptions', required: true },
    { id: 'access_verify', label: 'Verify campus access', required: true },
    { id: 'link_obtain', label: 'Get course link', required: true },
    { id: 'add_to_course', label: 'Add to course page', required: true }
  ]
};
```

### Task Completion Tracking

```javascript
// Backend tracks task completion
{
  "item_id": 363,
  "workflow_tasks": {
    "catalog_check": {
      "completed": true,
      "completed_by": 45,
      "completed_at": "2025-10-24 10:30:00",
      "notes": "Found in stacks, call number QH510 .B4"
    },
    "item_located": {
      "completed": true,
      "completed_by": 45,
      "completed_at": "2025-10-24 10:35:00"
    },
    "place_reserve": {
      "completed": false
    }
  }
}
```

---

## Database Schema Updates

```sql
-- Task completion tracking
CREATE TABLE submission_item_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  task_id VARCHAR(50) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_by_user_id INT NULL,
  completed_at DATETIME NULL,
  notes TEXT NULL,
  FOREIGN KEY (item_id) REFERENCES submission_new_resources(id),
  FOREIGN KEY (completed_by_user_id) REFERENCES users(id),
  INDEX idx_item_task (item_id, task_id)
);

-- Activity log for items
CREATE TABLE submission_item_activity (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  activity_type ENUM('claimed', 'status_change', 'task_complete', 'note_added', 'message_sent', 'handed_off', 'released'),
  activity_data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES submission_new_resources(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_item_activity (item_id, created_at DESC)
);
```

---

## Component Structure

### New Files to Create:

```
src/components/page-sections/admin/
├── SubmissionQueue.jsx (existing - will modify)
├── SubmissionDetail.jsx (existing - will modify for browse mode)
├── MyWorkQueue.jsx (NEW - main work interface)
├── WorkflowItemCard.jsx (NEW - full featured card for work mode)
├── TaskChecklist.jsx (NEW - material-type specific tasks)
├── ItemActionBar.jsx (NEW - all workflow actions)
├── ItemActivityLog.jsx (NEW - history of actions)
├── FacultyMessageModal.jsx (NEW - message to faculty)
├── StaffMessageModal.jsx (NEW - message to staff with @mentions)
└── HandoffModal.jsx (NEW - handoff to dept with note)
```

---

## Navigation Flow

### User Journey Example:

1. **Staff opens Admin page** → Lands on "Submissions Queue" tab
   - Sees list of all pending submissions
   - Can browse submissions, see items, read faculty notes
   - Items show "Unclaimed" or "Claimed by [name]"

2. **Staff finds an interesting item** → Clicks "Claim This Item"
   - Item is now assigned to them
   - Toast: "Item claimed! Go to My Work Queue to process it"
   - Badge changes to "Claimed by You"

3. **Staff clicks "My Work Queue" tab** → Sees only their claimed items
   - Items organized by submission
   - Full workflow interface available
   - Can see progress (2/5 tasks complete)

4. **Staff works through tasks:**
   - ☑ Check catalog → finds item
   - ☑ Locate item → found in stacks
   - Opens "Message Faculty" → "Your book is ready!"
   - ☑ Place on reserve
   - ☑ Notify faculty
   - Clicks "Mark Complete"

5. **Item disappears from My Work Queue** → Appears in faculty view as ready

---

## Benefits of This Approach

1. **Clear Ownership** - Can't work without claiming
2. **Focused Work Area** - My Work Queue only shows YOUR items
3. **Prevents Conflicts** - Can't accidentally work on someone else's item
4. **Better Task Management** - Checklist ensures nothing is missed
5. **Audit Trail** - Activity log shows who did what when
6. **Material-Type Workflows** - Different checklists for different types
7. **Easier Training** - Clear separation: browse vs. work

---

## Implementation Plan

### Step 1: Refactor Existing Components
- [ ] Modify `SubmissionDetail.jsx` to be "browse mode" only
- [ ] Simplify item cards - remove status dropdowns, action buttons
- [ ] Keep only "Claim" button for unclaimed items

### Step 2: Create My Work Queue
- [ ] New `MyWorkQueue.jsx` component
- [ ] Fetch only items where `claimed_by_user_id = current_user`
- [ ] Group by submission
- [ ] Full workflow UI

### Step 3: Add Task System
- [ ] Create `TaskChecklist.jsx` component
- [ ] Define task templates per material type
- [ ] API to mark tasks complete
- [ ] Progress indicator

### Step 4: Add Action Bar
- [ ] `ItemActionBar.jsx` with all workflow buttons
- [ ] Message modals (faculty & staff)
- [ ] Handoff modal with department selection
- [ ] Notes modal (existing)

### Step 5: Add Activity Log
- [ ] Track all actions in database
- [ ] Display timeline in item card
- [ ] Show who did what when

---

## API Endpoints Needed

```javascript
// Get my claimed items
GET /submission-workflow/my-work
// Returns all items where claimed_by_user_id = current user

// Get tasks for an item
GET /submission-workflow/item/{itemId}/tasks
// Returns task checklist with completion status

// Mark task as complete
POST /submission-workflow/item/{itemId}/task/{taskId}/complete
{
  "notes": "Found in stacks, good condition"
}

// Get activity log
GET /submission-workflow/item/{itemId}/activity
// Returns chronological history

// Send message to faculty
POST /submission-workflow/item/{itemId}/message-faculty
{
  "message": "Your book is ready for pickup!"
}

// Handoff to department
POST /submission-workflow/item/{itemId}/handoff
{
  "department": "acquisitions",
  "reason": "Need to order this item",
  "assign_to_user_id": 78 // optional
}
```

---

## Next Steps

Should I proceed with implementing this revised two-phase workflow? This will involve:

1. Simplifying the existing `SubmissionDetail` to browse-only mode
2. Creating the new `MyWorkQueue` component with full workflow tools
3. Building the task checklist system
4. Adding message and handoff modals

This is a better foundation for Phases 2-4 and makes much more sense from a UX perspective!

# Item Status Update Feature

## Overview
This feature allows staff members to update the processing status of individual items within faculty course reserve submissions. Staff can mark items as pending, in progress, complete, or unavailable, and add internal notes and faculty-visible notes.

## Implementation Summary

### 1. API Integration

**Endpoint:** `PUT /submission-workflow/item/{itemId}`

**Configuration:** `src/config/api.config.js`
```javascript
submissionWorkflow: {
  // ... other endpoints
  updateItem: '/submission-workflow/item/:itemId',
}
```

### 2. Service Layer

**File:** `src/services/admin/submissionWorkflowService.js`

**Method:** `updateItem(itemId, updates)`

**Parameters:**
- `itemId` (number): Item ID from `submission_new_resources` table
- `updates` (object): Fields to update
  - `item_status` (string, optional): 'pending' | 'in_progress' | 'complete' | 'unavailable'
  - `staff_notes` (string, optional): Internal notes visible only to staff
  - `priority` (string, optional): 'low' | 'medium' | 'high'
  - `faculty_notes` (string, optional): Notes visible to faculty member

**Returns:** Promise with updated item data

### 3. State Management

**File:** `src/store/submissionWorkflowStore.js`

**Action:** `updateItem(itemId, updates)`

**Behavior:**
- Calls service layer to update item via API
- Automatically refreshes submission detail after successful update
- Handles errors and updates error state
- Returns success/error result to caller

### 4. UI Components

#### ItemStatusModal Component

**File:** `src/components/page-sections/admin/ItemStatusModal.jsx`

**Purpose:** Modal dialog for updating item status and notes

**Features:**
- Form with status dropdown, priority selector, and note fields
- Displays item information (title, author, call number) for context
- Only sends changed fields to the API (optimized updates)
- Shows success/error messages
- Auto-closes after successful save
- Disables form while saving

**Props:**
- `isOpen` (boolean): Controls modal visibility
- `toggle` (function): Callback to close modal
- `item` (object): Item data to edit

#### SubmissionDetail Component Updates

**File:** `src/components/page-sections/admin/SubmissionDetail.jsx`

**Changes:**
- Added "Update Status" button to each ItemCard
- Integrated ItemStatusModal component
- Added modal state management (isModalOpen, selectedItem)
- Added handlers: handleEditItem, handleCloseModal
- Passes onEdit callback to ItemCard components
- Displays staff notes in item cards (visible only to staff)

### 5. Constants

**File:** `src/constants/submissionWorkflow.js`

**Added Constants:**
- `ITEM_STATUS_CONFIG`: Configuration for item status display
- `ITEM_PRIORITY`: Priority level values
- `ITEM_PRIORITY_CONFIG`: Configuration for priority display

## User Workflow

### Typical Staff Workflow:

1. **Navigate to submission detail page**
   - View all items in the submission
   - See current status and priority for each item

2. **Lock submission** (optional but recommended)
   - Prevents other staff from editing simultaneously

3. **Process each item:**
   - Click "Update Status" button on an item
   - Modal opens with current item information
   - Update status (pending → in_progress → complete or unavailable)
   - Add staff notes (internal only)
   - Optionally add faculty notes (visible to submitter)
   - Adjust priority if needed
   - Click "Save Changes"

4. **Review progress**
   - Statistics update automatically
   - Completion percentage recalculates
   - Status badges update in real-time

5. **Unlock submission**
   - When done processing, unlock for others

## Item Status Lifecycle

```
pending (default)
  ↓
in_progress (staff actively working on it)
  ↓
complete (placed on reserve, ready)
  OR
unavailable (cannot be fulfilled)
```

## Field Descriptions

### Item Status
- **Pending**: Item has not been started yet (default)
- **In Progress**: Staff is actively working on locating/processing this item
- **Complete**: Item has been placed on reserve and is ready for pickup
- **Unavailable**: Item cannot be fulfilled (checked out, missing, unavailable for reserves, etc.)

### Priority
- **Low**: Can be processed later
- **Medium**: Normal processing priority (default)
- **High**: Should be processed as soon as possible

### Staff Notes
- Internal notes only visible to staff members
- Use for location information, processing status, problems encountered
- Examples: "Located in stacks, moving to reserves desk", "Book is checked out, due back in 2 weeks"

### Faculty Notes
- Visible to the faculty member who submitted the request
- Use for updates, explanations, or requests for clarification
- Examples: "This edition is not available, using 2nd edition instead", "Please confirm this is the correct chapter"

## API Request/Response Examples

### Update Item Status to In Progress

**Request:**
```bash
PUT /submission-workflow/item/363
Content-Type: application/json
Authorization: Bearer {token}

{
  "item_status": "in_progress",
  "staff_notes": "Located in stacks, moving to reserves desk"
}
```

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "363",
    "submission_id": "28",
    "item_status": "in_progress",
    "staff_notes": "Located in stacks, moving to reserves desk",
    "updated_at": "2025-10-23 18:32:02",
    ...
  },
  "message": "Item updated successfully"
}
```

### Mark Item as Complete

**Request:**
```bash
PUT /submission-workflow/item/364
Content-Type: application/json
Authorization: Bearer {token}

{
  "item_status": "complete",
  "staff_notes": "Item placed on reserve shelf, ready for pickup"
}
```

### Mark Item as Unavailable

**Request:**
```bash
PUT /submission-workflow/item/365
Content-Type: application/json
Authorization: Bearer {token}

{
  "item_status": "unavailable",
  "staff_notes": "Book is checked out, due back in 2 weeks",
  "faculty_notes": "This item is currently unavailable but will be reserved when returned"
}
```

## Error Handling

The implementation includes comprehensive error handling:

- **Network errors**: Caught and displayed to user
- **Validation errors**: Backend validation errors shown in modal
- **Concurrent edits**: Lock system prevents conflicts
- **Permission errors**: Handled by authentication layer
- **Not found errors**: Item or submission not found

## Future Enhancements

Potential improvements for this feature:

1. **Bulk updates**: Update status for multiple items at once
2. **Status history**: Track all status changes with timestamps
3. **Notifications**: Notify faculty when items marked complete or unavailable
4. **Templates**: Pre-filled note templates for common scenarios
5. **Quick actions**: Keyboard shortcuts for common status updates
6. **Filters**: Filter items by status in detail view
7. **Export**: Export item processing report

## Related Documentation

- [Backend API Documentation](../BACKEND_UPDATE_INSTRUCTIONS.md)
- [Submission Workflow Overview](./SUBMISSION_WORKFLOW.md)
- [Faculty Portal Specifications](../FACULTY_PORTAL_SPECIFICATIONS.md)

## Testing Checklist

- [ ] Can open item status modal
- [ ] Status dropdown shows all options
- [ ] Priority selector works correctly
- [ ] Staff notes save and display
- [ ] Faculty notes save and display
- [ ] Only changed fields sent to API
- [ ] Error messages display properly
- [ ] Success message shows and modal closes
- [ ] Statistics update after save
- [ ] Status badges update in real-time
- [ ] Modal closes when clicking outside or cancel
- [ ] Form validation works
- [ ] Works with locked submissions
- [ ] Works with unlocked submissions
- [ ] Permission checks apply

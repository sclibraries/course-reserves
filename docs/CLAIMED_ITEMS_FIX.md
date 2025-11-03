# Fixed: Items Showing as Unclaimed After Claiming

## Problem

After claiming an item, it still showed as "Unclaimed" in the UI even though the backend had successfully saved the claim.

## Root Cause

**Type Mismatch**: The backend was returning `claimed_by_staff_id` as a **string** (`"1"`), but the frontend was comparing it with `currentUser.id` which is a **number** (1).

```javascript
// This was failing:
if (item.claimedBy.id === currentUser.id)  // "1" === 1 → false
```

## Additional Issues Found

1. **Wrong field name**: Service was looking for `claimed_by_user_id` but backend returns `claimed_by_staff_id`
2. **Missing display name**: Backend doesn't include the user's display name in the submission detail response

## Solution Implemented

### 1. Fixed Type Conversion
Updated `submissionWorkflowService.js` to parse the string ID to a number:

```javascript
const claimedByStaffId = resource.claimed_by_staff_id ? 
  parseInt(resource.claimed_by_staff_id, 10) : null;
```

### 2. Fixed Field Name
Changed from looking for `claimed_by_user_id` to `claimed_by_staff_id` to match backend response.

### 3. Extract Display Name from staff_notes
Since the backend doesn't include the user's display name in the submission detail, we extract it from the `staff_notes` field which contains:
```
"Claimed by Rob O'Connell at 2025-10-24 19:30:52"
```

Used regex to parse this:
```javascript
const match = resource.staff_notes.match(/Claimed by (.+?) at \d{4}-\d{2}-\d{2}/);
if (match) {
  displayName = match[1]; // "Rob O'Connell"
}
```

Fallback to `"Staff Member #X"` if name can't be extracted.

## Changes Made

**File**: `src/services/admin/submissionWorkflowService.js`

**Function**: `formatSubmissionDetail()`

**Lines Changed**: ~535-545

```javascript
// Before:
const claimedBy = resource.claimed_by_user_id ? {
  id: resource.claimed_by_user_id,
  username: resource.claimed_by_username || '',
  display_name: resource.claimed_by_display_name || ''
} : null;

// After:
const claimedByStaffId = resource.claimed_by_staff_id ? 
  parseInt(resource.claimed_by_staff_id, 10) : null;

let displayName = '';
if (claimedByStaffId && resource.staff_notes) {
  const match = resource.staff_notes.match(/Claimed by (.+?) at \d{4}-\d{2}-\d{2}/);
  if (match) {
    displayName = match[1];
  }
}

const claimedBy = claimedByStaffId ? {
  id: claimedByStaffId,
  username: resource.claimed_by_username || '',
  display_name: displayName || `Staff Member #${claimedByStaffId}`
} : null;
```

## Testing Checklist

- [x] Fixed type conversion (string to number)
- [x] Fixed field name (claimed_by_staff_id vs claimed_by_user_id)
- [x] Added display name extraction from staff_notes
- [x] Added fallback for display name
- [ ] Test: Claim an item and verify it shows "Claimed by You"
- [ ] Test: View item claimed by someone else and verify it shows their name
- [ ] Test: Navigate to My Work Queue and verify claimed items appear

## Backend Improvement Needed

**TODO**: The backend should include user details in the submission detail response to avoid parsing staff_notes.

**Current Response**:
```json
{
  "id": "371",
  "claimed_by_staff_id": "1",  // string
  "claimed_at": "2025-10-24 19:30:52",
  "staff_notes": "Claimed by Rob O'Connell at 2025-10-24 19:30:52"
}
```

**Improved Response**:
```json
{
  "id": "371",
  "claimed_by_staff_id": 1,  // number
  "claimed_by_username": "roconnell",
  "claimed_by_display_name": "Rob O'Connell",
  "claimed_at": "2025-10-24 19:30:52",
  "staff_notes": "Claimed by Rob O'Connell at 2025-10-24 19:30:52"
}
```

This would eliminate the need for regex parsing and provide consistent data.

## Expected Behavior Now

### When You Claim an Item:
1. Click "Claim This Item"
2. Toast shows: "Item claimed! [Go to My Work →]"
3. Item immediately shows badge: "Claimed by You"
4. "Work on This" button appears

### When Viewing Items:
- **Unclaimed items**: Show "Unclaimed" badge + "Claim This Item" button
- **Your claimed items**: Show "Claimed by You" badge + "Work on This" button  
- **Others' claimed items**: Show "Claimed by [Name]" badge (read-only)

### In My Work Queue:
- Shows all items where `claimedBy.id === currentUser.id`
- Full workflow tools available

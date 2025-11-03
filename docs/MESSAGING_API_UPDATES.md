# Messaging System API Integration Updates

## Summary of Changes

Updated all messaging components to work with the correct API structure based on the Staff Communication API documentation.

## Key Changes

### 1. Submission ID Type
**Problem:** Components were looking for UUID, but API requires **numeric submission_id**

**Solution:** Updated all three modals to use:
```javascript
const submissionId = item.submission_id || item.submission?.submission_id || item.submission?.id;
```

**Affected Files:**
- `StaffMessagingModal.jsx`
- `FacultyMessageModal.jsx`
- `QuickNoteModal.jsx`

### 2. API Response Structure
**Problem:** API returns `{ messages: [...], submission: {...} }`, not a flat array

**Solution:** Updated service to extract messages array:
```javascript
const data = await response.json();
return data.messages || [];
```

**Affected Files:**
- `submissionWorkflowService.js` - `getSubmissionCommunications()`

### 3. Field Name Mapping
**Problem:** API uses different field names than assumed

**Solution:** Updated display components to use correct field names:
- `sender_name` instead of `author_display_name`
- `communication_type` field available
- `replies` array embedded in messages

**Affected Files:**
- `CommunicationsPanel.jsx`

## API Endpoint Structure

### Create Communication
```
POST /submission-workflow/submission/{numeric-id}/communications
```
**Example:** `/submission-workflow/submission/29/communications` (NOT UUID)

### Get Communications
```
GET /submission-workflow/submission/{numeric-id}/communications
```
**Returns:**
```json
{
  "messages": [
    {
      "id": 123,
      "submission_id": 29,
      "sender_name": "Jane Smith",
      "sender_email": "jsmith@smith.edu",
      "message": "@roconnell can you help?",
      "category": "cataloging",
      "priority": "normal",
      "visibility": "staff_only",
      "is_task": true,
      "task_assignee": "roconnell",
      "task_due_date": "2025-11-15",
      "created_at": "2025-10-28 10:30:00",
      "metadata": {
        "mentions": ["roconnell"]
      },
      "replies": [...]
    }
  ],
  "submission": {
    "submission_id": "29",
    "course_code": "HST 243",
    "status": "submitted"
  }
}
```

## Error Handling

All modals now include:
1. **Submission ID validation** - Checks multiple possible paths
2. **Console logging** - Logs item structure if ID not found
3. **User-friendly error** - Shows toast: "Unable to find submission ID"
4. **Early return** - Prevents API call with undefined ID

Example:
```javascript
const submissionId = item.submission_id || item.submission?.submission_id || item.submission?.id;

if (!submissionId) {
  console.error('Item structure:', item);
  toast.error('Unable to find submission ID');
  setSending(false);
  return;
}
```

## Testing Checklist

- [ ] Open My Work Queue
- [ ] Claim an item
- [ ] Click "Message Staff" - should open modal
- [ ] Send message with @mention - check Network tab for correct URL
- [ ] Verify URL is `/submission/29/communications` (numeric, not UUID)
- [ ] Check success toast appears
- [ ] Repeat for "Message Faculty" and "Add Notes"
- [ ] View CommunicationsPanel (when integrated)
- [ ] Verify messages display with sender names

## Debugging

If you see "Unable to find submission ID":
1. Check browser console for logged item structure
2. Look for `submission_id`, `submission.submission_id`, or `submission.id`
3. Update the ID extraction logic if structure differs

If API returns 404:
- Verify the submission_id is numeric (e.g., 29, not a UUID)
- Check Network tab for actual URL being called
- Confirm backend route matches pattern

## Additional Features from API Docs

The backend API now supports (not yet in UI):

### Unread Count
```javascript
GET /submission-workflow/my-unread-count
// Returns: { unread_count: 3, user_id: "1", username: "roconnell" }
```

### My Mentions
```javascript
GET /submission-workflow/my-mentions
// Returns all messages where current user was @mentioned
```

### Mark as Read
```javascript
POST /submission-workflow/communications/{messageId}/read
```

### Update Communication
```javascript
PUT /submission-workflow/communications/{messageId}
// Body: { message: "Updated text" }
```

## Future Enhancements

1. **Badge for unread mentions** - Poll `/my-unread-count` endpoint
2. **My Mentions page** - Use `/my-mentions` endpoint
3. **Mark as read** - Integrate `markAsRead()` service method
4. **Edit messages** - Use `updateCommunication()` service method
5. **Reply functionality** - Add reply button with `parent_message_id`
6. **Real-time updates** - WebSocket or polling for new messages

## Files Modified

1. ✅ `src/services/admin/submissionWorkflowService.js`
   - Updated `getSubmissionCommunications()` to extract messages array
   - Added comment about numeric ID requirement

2. ✅ `src/components/page-sections/admin/StaffMessagingModal.jsx`
   - Changed to use numeric `submission_id`
   - Added validation and error handling

3. ✅ `src/components/page-sections/admin/FacultyMessageModal.jsx`
   - Changed to use numeric `submission_id`
   - Added validation and error handling

4. ✅ `src/components/page-sections/admin/QuickNoteModal.jsx`
   - Changed to use numeric `submission_id`
   - Added validation and error handling

5. ✅ `src/components/page-sections/admin/CommunicationsPanel.jsx`
   - Updated field names to use `sender_name`
   - Handles `messages` array from API response

## Status

✅ **Ready for Testing** - All components updated to match API specification

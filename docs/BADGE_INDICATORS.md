# Badge Indicators for Submission Queues

**Date:** October 24, 2025  
**Status:** ✅ Complete

## Feature Overview

Added badge indicators to the **Submissions Queue** and **My Work Queue** tabs to show the count of items in each queue at a glance.

## Changes Made

### 1. Admin.jsx Updates

**Added Store Hook:**
```javascript
import useSubmissionWorkflowStore from '../store/submissionWorkflowStore';

const { 
  pagination: submissionPagination,
  claimedItems,
  fetchPendingSubmissions,
  fetchClaimedItems
} = useSubmissionWorkflowStore();

const submissionsCount = submissionPagination?.totalCount || 0;
const myWorkCount = claimedItems?.length || 0;
```

**Added Data Fetching:**
```javascript
useEffect(() => {
  if (canManageSubmissions) {
    // Fetch pending submissions count (first page to get total count)
    fetchPendingSubmissions(1, 20);
    // Fetch claimed items count
    fetchClaimedItems();
  }
}, [canManageSubmissions, fetchPendingSubmissions, fetchClaimedItems]);
```

**Desktop Tab Badges:**
```jsx
{canManageSubmissions && (
  <button 
    className={`tab-button ${activeTab === 'submissions' ? 'active' : ''}`}
    onClick={() => handleTabChange('submissions')}>
    Submissions Queue
    {submissionsCount > 0 && (
      <Badge color="primary" pill className="ms-2">
        {submissionsCount}
      </Badge>
    )}
  </button>
)}

{canManageSubmissions && (
  <button 
    className={`tab-button ${activeTab === 'my-work' ? 'active' : ''}`}
    onClick={() => handleTabChange('my-work')}>
    My Work Queue
    {myWorkCount > 0 && (
      <Badge color="success" pill className="ms-2">
        {myWorkCount}
      </Badge>
    )}
  </button>
)}
```

**Mobile Dropdown Badges:**
```jsx
<DropdownToggle caret>
  {activeTab === 'submissions' && (
    <span>
      Submissions Queue
      {submissionsCount > 0 && (
        <Badge color="primary" pill className="ms-2">
          {submissionsCount}
        </Badge>
      )}
    </span>
  )}
  {activeTab === 'my-work' && (
    <span>
      My Work Queue
      {myWorkCount > 0 && (
        <Badge color="success" pill className="ms-2">
          {myWorkCount}
        </Badge>
      )}
    </span>
  )}
</DropdownToggle>

<DropdownMenu>
  <DropdownItem className="d-flex justify-content-between align-items-center">
    <span>Submissions Queue</span>
    {submissionsCount > 0 && (
      <Badge color="primary" pill>
        {submissionsCount}
      </Badge>
    )}
  </DropdownItem>
  
  <DropdownItem className="d-flex justify-content-between align-items-center">
    <span>My Work Queue</span>
    {myWorkCount > 0 && (
      <Badge color="success" pill>
        {myWorkCount}
      </Badge>
    )}
  </DropdownItem>
</DropdownMenu>
```

### 2. Admin.css Updates

**Tab Button Flexbox:**
```css
.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab-button .badge {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  font-weight: 600;
  vertical-align: middle;
}
```

## Badge Color Scheme

- **Submissions Queue**: `primary` (blue) badge
  - Shows total count of pending submissions from backend pagination
  
- **My Work Queue**: `success` (green) badge
  - Shows count of items claimed by current user

## How It Works

### Data Sources

1. **Submissions Count**: 
   - Comes from `submissionPagination.totalCount`
   - Backend returns this in the pagination metadata
   - Represents all pending submissions across all faculty

2. **My Work Count**:
   - Comes from `claimedItems.length`
   - Array of items claimed by current authenticated user
   - Backend determines user from auth token

### Update Behavior

The counts are fetched:
- **On initial load** when user has `manage_submissions` permission
- **Automatically** when the store's data changes (React state updates)
- Counts update when:
  - Items are claimed/unclaimed
  - Submissions are added/removed
  - Items are marked complete

### Badge Display Logic

Badges only show when count > 0:
```javascript
{submissionsCount > 0 && (
  <Badge color="primary" pill className="ms-2">
    {submissionsCount}
  </Badge>
)}
```

This prevents showing "0" badges when queues are empty.

## Visual Design

### Desktop Tabs
```
┌────────────────────────────────────────────────┐
│ Submissions Queue [23]   My Work Queue [5]    │
└────────────────────────────────────────────────┘
```

- Badges appear inline with tab text
- 0.5rem gap between text and badge
- Pills are small (0.7rem font size)
- Blue for submissions, green for my work

### Mobile Dropdown
```
┌──────────────────────────────────────┐
│ ▼ Submissions Queue [23]             │
└──────────────────────────────────────┘

Dropdown Menu:
┌──────────────────────────────────────┐
│ Submissions Queue            [23]    │
│ My Work Queue               [5]      │
│ Reports                              │
└──────────────────────────────────────┘
```

- Badge in toggle button when that tab is active
- All tabs show badges in dropdown menu
- Right-aligned using flexbox justify-content-between

## Benefits

1. **At-a-Glance Awareness**: Staff can see queue sizes without clicking
2. **Priority Indication**: High counts signal need for attention
3. **Personal Workload**: My Work badge shows personal task count
4. **Real-Time Updates**: Badges update as items are processed
5. **Mobile-Friendly**: Works on both desktop and mobile views

## Future Enhancements

1. **Color Coding by Urgency**:
   - `danger` (red) badge if count > 50
   - `warning` (yellow) badge if count > 25
   - `success` (green) otherwise

2. **Breakdown Tooltips**:
   - Hover over badge to see breakdown by material type
   - Show oldest submission age

3. **Auto-Refresh**:
   - Poll backend every 30 seconds for updated counts
   - WebSocket connection for real-time updates

4. **Animation**:
   - Pulse animation when new items arrive
   - Badge grows briefly to draw attention

5. **Additional Counts**:
   - Show count of items needing attention (faculty messages, errors)
   - Separate badge colors for different status types

## Testing Checklist

- [x] Desktop tabs show correct submission count
- [x] Desktop tabs show correct my work count
- [x] Mobile toggle shows badge for active tab
- [x] Mobile dropdown shows badges for both tabs
- [x] Badges hidden when count is 0
- [x] Badges update after claiming item
- [x] Badges update after releasing item
- [x] Badges update after marking complete
- [x] CSS styling looks good on all screen sizes
- [x] No console errors

## Files Modified

1. **src/pages/Admin.jsx**
   - Added `useSubmissionWorkflowStore` import
   - Added Badge import from reactstrap
   - Added count variables and fetch logic
   - Added badges to desktop tabs
   - Added badges to mobile dropdown

2. **src/css/Admin.css**
   - Updated `.tab-button` to use flexbox
   - Added `.tab-button .badge` styling
   - Removed empty ruleset

---

## Related Documentation

- `MY_WORK_QUEUE_STREAMLINED_REDESIGN.md` - Table-based queue design
- `SUBMISSION_QUEUE_FIXES.md` - Recent bug fixes
- `TWO_PHASE_WORKFLOW_COMPLETE.md` - Browse vs work queue separation

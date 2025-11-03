# Work Queue UI Improvements - October 28, 2025

## Changes Made

### 1. Simplified My Work Queue Table (`/admin?tab=my-work`)

**Removed:**
- ❌ Expand/collapse functionality (no more dropdown details)
- ❌ Status column (removed from table view)
- ❌ Complex action dropdown menu
- ❌ Inline editing and messaging modals
- ❌ All unused handlers and state management

**Added:**
- ✅ Simple "Process" button for each item
- ✅ Clean 4-column table: Item | Course | Type | Actions
- ✅ Direct navigation to detail view

**Result:**
- Much cleaner, simpler table view
- One clear action per row: "Process"
- No clutter, easy to scan
- All detailed work happens in the detail view

### 2. Reorganized Work Queue Detail Layout (`/admin/work-queue/:itemId`)

**New Three-Panel Layout:**

```
┌──────────────────────────────────────────────────────┐
│ ← Back to Queue | My Work Queue            [5 items] │
├───────────────┬────────────────┬─────────────────────┤
│               │                │                     │
│ LEFT PANEL    │ CENTER PANEL   │ RIGHT PANEL         │
│ (350px)       │ (300px)        │ (flex)              │
│               │                │                     │
│ Item Details  │ Queue Items    │ Communications      │
│ + Actions     │ List           │ Thread              │
│               │                │                     │
│ ┌───────────┐ │ • Item 1       │ Faculty Messages    │
│ │ Details   │ │ • Item 2*      │ ├─ Msg 1           │
│ │ Card      │ │ • Item 3       │ │  └─ Reply         │
│ └───────────┘ │                │ └─ Msg 2           │
│               │                │                     │
│ ┌───────────┐ │                │ Staff Messages      │
│ │ Actions   │ │                │ ├─ Note 1          │
│ │ Card      │ │                │ └─ Thread          │
│ └───────────┘ │                │                     │
│               │                │                     │
└───────────────┴────────────────┴─────────────────────┘
```

**Changes:**
- **Left Panel** (was center): Item details + all action buttons
- **Center Panel** (was left): Queue items list for quick switching
- **Right Panel** (unchanged): Communications thread

**Benefits:**
- Item details more prominent on the left
- Queue list in middle for easy item switching
- Communications get most horizontal space (flex: 1)
- More logical flow: details → queue → communications

### 3. Fixed Data Loading Issues

**Problem:**
Item details and communications weren't loading properly in the work queue detail view.

**Root Causes:**
1. `resource_data` JSON wasn't being parsed
2. CommunicationsPanel was receiving wrong props
3. Missing proper field mapping (submission data structure)

**Solutions:**

#### A. Added Data Formatting (WorkQueueDetail.jsx)
```javascript
const formatItems = () => {
  if (!claimedItems) return [];
  
  return claimedItems.map(item => {
    let resourceData = {};
    try {
      resourceData = item.resource_data ? JSON.parse(item.resource_data) : {};
    } catch (e) {
      console.warn('Failed to parse resource_data:', e);
    }
    
    return {
      ...item,
      title: resourceData.title || item.title || 'Untitled',
      authors: resourceData.authors || '',
      course_code: item.submission?.course_code || item.course_code || 'N/A',
      instructor_name: item.submission?.faculty_display_name || 
                       item.instructor_name || 
                       item.faculty_name || 'N/A',
      materialTypeName: item.materialType?.name || 
                        resourceData.materialType || 'Unknown',
      // ... other fields
    };
  });
};
```

#### B. Fixed CommunicationsPanel Props
**Before (Wrong):**
```jsx
<CommunicationsPanel
  ref={communicationsRef}
  item={selectedItem}
  refreshTrigger={refreshTrigger}
/>
```

**After (Correct):**
```jsx
<CommunicationsPanel
  ref={communicationsRef}
  submissionId={selectedItem.submission_id}
  resourceId={selectedItem.resource_id || selectedItem.id}
/>
```

**Why:** CommunicationsPanel expects `submissionId` and `resourceId` props, not an `item` object.

#### C. Proper Field Mapping
- `course_code`: Checks `item.submission?.course_code` first
- `instructor_name`: Checks multiple possible fields
- `title`: Parses from `resource_data` JSON
- All data properly formatted before display

## Files Modified

### Changed Files:

1. **`src/components/page-sections/admin/MyWorkQueue.jsx`**
   - Removed expand/collapse state and handlers
   - Removed modal states (messaging, notes)
   - Removed status dropdown column
   - Removed complex action dropdown
   - Simplified WorkQueueRow to just show "Process" button
   - Cleaned up unused imports
   - Reduced from ~500 lines to ~200 lines

2. **`src/pages/WorkQueueDetail.jsx`**
   - Added `formatItems()` function to parse resource_data
   - Swapped left and center panel content
   - Fixed CommunicationsPanel props (submissionId, resourceId)
   - Updated handleSendMessage to use ref.refresh()
   - Removed unused refreshTrigger state

3. **`src/pages/WorkQueueDetail.css`**
   - Updated panel widths:
     - Left: 350px (was 300px)
     - Center: 300px (was flex: 1)
     - Right: flex: 1 (was 400px fixed)
   - Updated responsive breakpoints
   - Maintained proper panel scrolling

## Testing Checklist

### My Work Queue Tab
- [ ] Table shows 4 columns: Item, Course, Type, Actions
- [ ] No status column visible
- [ ] No expand/collapse chevrons
- [ ] Each row has single "Process" button
- [ ] Clicking "Process" navigates to detail view
- [ ] Table is clean and easy to scan

### Work Queue Detail Page
- [ ] **Left Panel** shows item details correctly:
  - [ ] Course code displays
  - [ ] Instructor name displays
  - [ ] Title displays (from resource_data)
  - [ ] Status dropdown works
  - [ ] All action buttons present
- [ ] **Center Panel** shows queue items list:
  - [ ] All claimed items listed
  - [ ] Active item highlighted
  - [ ] Click to switch between items
  - [ ] Unread badges show if applicable
- [ ] **Right Panel** shows communications:
  - [ ] Faculty messages section appears
  - [ ] Staff messages section appears
  - [ ] Messages load correctly
  - [ ] Threading works
  - [ ] Reply functionality works

### Data Loading
- [ ] Item details populate immediately
- [ ] Communications load without errors
- [ ] Switching items updates all panels
- [ ] Sending message refreshes communications
- [ ] No console errors about missing data

### Navigation
- [ ] From My Work → Process button → Detail view
- [ ] Back button returns to My Work tab
- [ ] Switching items updates URL (/admin/work-queue/123)
- [ ] Browser back/forward works correctly

## Technical Details

### Data Flow
1. **Fetch:** `fetchClaimedItems()` gets raw data from API
2. **Format:** `formatItems()` parses resource_data JSON
3. **Select:** Item selected based on URL param (itemId)
4. **Display:** Formatted data shown in all three panels
5. **Communicate:** CommunicationsPanel loads using submissionId

### Key Props
- **CommunicationsPanel:**
  - `submissionId` (number): The submission ID
  - `resourceId` (number): The resource/item ID
  - `ref`: For calling refresh() method

### Performance
- Data parsed once via `formatItems()`
- Communications load only for selected item
- Switching items doesn't refetch entire queue
- Ref-based refresh avoids prop drilling

## Migration Notes

### For Users
- **Old workflow:** Click expand → view details → take actions
- **New workflow:** Click "Process" → see everything → take actions
- Benefit: One click instead of multiple clicks + scrolling

### For Developers
- MyWorkQueue is now much simpler (presentation only)
- All complex logic moved to WorkQueueDetail
- Easier to maintain and extend
- Clear separation of concerns

## Future Enhancements

### Possible Additions:
1. **Keyboard shortcuts** in detail view
   - `j/k` for next/previous item
   - `c` for mark complete
   - `m` for message faculty

2. **Bulk actions** in My Work table
   - Select multiple items
   - Apply actions to group

3. **Filters** in queue items panel
   - By status
   - By priority
   - By type

4. **Quick preview** on hover
   - Tooltip with basic info
   - No need to click to see details

## Summary

These changes create a **cleaner, more focused workflow**:

1. ✅ **Simple list view** for overview and selection
2. ✅ **Dedicated detail view** for focused work
3. ✅ **Proper data loading** for all panels
4. ✅ **Logical panel layout** (details → queue → communications)

Users can now quickly scan the My Work queue and click "Process" to dive into the full-featured detail view with all information properly loaded and displayed.

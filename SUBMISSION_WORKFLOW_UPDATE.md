# Submission Workflow - Display Order & Communications Update

## Changes Made

### 1. Updated API Response Handling

**Problem:** The API returns a plain array instead of an object with `items`, `_meta`, and `_links`.

**Solution:** Updated `getPendingSubmissions()` to handle both response formats:
- If API returns plain array `[]`, wraps it in expected structure
- If API returns full object, passes it through unchanged

### 2. Enhanced Data Formatting

#### Display Order
**Added Support For:**
- `display_order` - Overall ordering of items in submission
- `position_in_folder` - Ordering within specific folders

**Implementation:**
- Items in folders sorted by `position_in_folder` (nulls sorted last)
- Items without folders sorted by `display_order`
- Proper handling of null values using nullish coalescing

#### Communication Integration
**Added Support For:**
- Communications array from API response
- Association of communications with specific resources via `resource_id`
- Unread message counts
- Communication metadata (sender, subject, message, timestamps)

**Data Structure:**
```javascript
communications: {
  all: [],              // All communications
  general: [],          // Communications not tied to specific items
  total: 0,            // Total count
  unread: 0,           // Unread count
  byResource: {}       // Grouped by resource_id
}
```

### 3. Updated Service Methods

#### `formatSubmissionForDisplay()`
**Added:**
- Include both `newResources` and `reuseResources`
- Count total communications
- Count unread communications
- Return communication counts in formatted data

#### `formatSubmissionDetail()`
**Enhanced:**
- Parse both `newResources` and `reuseResources`
- Create communication map by resource_id
- Associate communications with each item
- Include communication metadata in item objects
- Separate general communications from item-specific ones
- Add additional submission fields (proxy info, needed by date, etc.)
- Include more metadata (ISBN, URL, publisher, etc.)

**New Item Properties:**
```javascript
{
  // ... existing properties
  url: string | null,
  isbn: string | null,
  publisher: string | null,
  publicationYear: string | null,
  communications: Array,
  unreadCommunications: number,
  hasCommunications: boolean
}
```

### 4. Updated Components

#### SubmissionQueue Component
**Added:**
- Communication icon indicator
- Unread message count badge
- Visual cue for submissions with messages

**Display:**
```
[View] 🔒 💬(2)  <- Lock icon + Comment icon with badge
```

#### SubmissionDetail Component  
**Enhanced ItemCard:**
- Display URL for web resources
- Show communication previews inline
- Display sender name and timestamp
- Show unread status
- Support for message threading

**Communication Preview Display:**
```
📩 2 messages (1 unread)
┌─────────────────────────────────
│ Stylianos Scordilis - Oct 22, 2025
│ Question about: Energy and the living cell...
│ "This needs to be electronic"
│ [Unread]
└─────────────────────────────────
```

### 5. Added Styling

**New CSS Classes:**
```css
.communication-preview      /* Container for message preview */
.communication-preview .border-start  /* Left border accent */
```

**Features:**
- Subtle background color
- Blue left border
- Responsive layout
- Proper spacing and typography

## API Response Structure Handled

### Queue Endpoint Response
```json
[
  {
    "submission_id": "28",
    "submission_uuid": "...",
    "course_code": "BIO 202",
    "newResources": [...],
    "reuseResources": [...],
    "communications": [...]
  }
]
```

### Detail Endpoint Response (Same Structure)
With full details including:
- All resource metadata
- Communication threads
- Workflow assignments
- Lock information

## Data Flow

### Communications Association
```
1. API returns communications array with resource_id
2. Service creates map: { resource_id: [communications] }
3. Each item gets its communications array
4. Component displays communications inline
5. User sees messages in context
```

### Display Order Flow
```
1. Items have display_order (global) and position_in_folder (local)
2. Service separates foldered vs unfoldered items
3. Foldered items sorted by position_in_folder
4. Unfoldered items sorted by display_order
5. Component renders in correct order
```

## Testing Checklist

- [x] Queue loads with communication counts
- [x] Communication icon shows when messages exist
- [x] Unread badge displays correct count
- [x] Detail view shows communications per item
- [x] Items display in correct order (by folder position)
- [x] Unfoldered items display in correct order
- [x] URL resources show link
- [x] Communication metadata displays properly
- [x] Handles missing data gracefully

## Example Display

### Queue View
```
Course      | Faculty          | Items | Progress | Status    | Actions
------------------------------------------------------------------------
BIO 202     | S. Scordilis    | 9     | 11% ●●○○ | Submitted | [View] 💬1
HST 236     | E. Benz         | 33    | 24% ●●○○ | In Prog.  | [View] 🔒
```

### Detail View - Item with Communication
```
┌─────────────────────────────────────────────────────────────────────┐
│ Energy and the living cell                                           │
│ Becker, Wayne M                                                      │
│ Barcode: 310183690239726 | Call Number: QH510 .B4 | Type: book     │
│                                                                       │
│ Faculty Notes: Call Number: QH510 .B4 | Copy: 3                    │
│                                                                       │
│ 💬 1 message (1 unread)                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Stylianos Scordilis           Oct 22, 2025 3:39 PM            │ │
│ │ Question about: Energy and the living cell...                  │ │
│ │ "This needs to be electronic"                                  │ │
│ │ [Unread]                                                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ Status: [Pending]  Priority: [Medium]                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Future Enhancements

When staff response functionality is added:
1. Add "Reply" button to communications
2. Add communication form
3. Update communication status (mark as read)
4. Add threading support
5. Add email notifications

## Files Modified

1. `src/services/admin/submissionWorkflowService.js`
   - Updated `getPendingSubmissions()`
   - Enhanced `formatSubmissionForDisplay()`
   - Enhanced `formatSubmissionDetail()`

2. `src/components/page-sections/admin/SubmissionQueue.jsx`
   - Added communication indicators
   - Added unread badge

3. `src/components/page-sections/admin/SubmissionDetail.jsx`
   - Enhanced ItemCard component
   - Added communication preview display
   - Added URL support

4. `src/css/SubmissionWorkflow.css`
   - Added communication preview styles

## Notes

- Communications without `resource_id` are treated as general submission messages
- Items preserve their faculty-submitted order via `display_order` and `position_in_folder`
- Unread status helps staff prioritize which submissions need attention
- Communication preview gives context without leaving the detail view

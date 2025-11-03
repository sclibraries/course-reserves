# Faculty Submission Workflow - Implementation Summary

## Overview
This implementation adds a new "Process Submissions" tab to the admin interface where staff can view and process faculty course material submissions.

## Files Created

### 1. Service Layer
**`src/services/admin/submissionWorkflowService.js`**
- Handles all API calls for submission workflow
- Methods:
  - `getPendingSubmissions(page, perPage)` - Fetch paginated list of pending submissions
  - `getSubmissionDetail(submissionId)` - Fetch detailed submission information
  - `lockSubmission(submissionUuid, lockReason)` - Lock a submission for processing
  - `unlockSubmission(submissionUuid)` - Unlock a submission
  - `formatSubmissionForDisplay(submission)` - Format submission data for queue display
  - `formatSubmissionDetail(response)` - Format detailed submission data
  - `determinePriority(submission, daysSince)` - Calculate submission priority

### 2. State Management
**`src/store/submissionWorkflowStore.js`**
- Zustand store for managing submission workflow state
- State includes:
  - `submissions` - Array of formatted submissions
  - `selectedSubmission` - Currently viewed submission detail
  - `loading` - Loading state
  - `error` - Error messages
  - `pagination` - Pagination metadata
- Actions:
  - `fetchPendingSubmissions(page, perPage)`
  - `fetchSubmissionDetail(submissionId)`
  - `lockSubmission(submissionUuid, lockReason)`
  - `unlockSubmission(submissionUuid)`
  - `setPage(page)`
  - `clearSelectedSubmission()`
  - `clearError()`
  - `reset()`

### 3. Components
**`src/components/page-sections/admin/SubmissionQueue.jsx`**
- Displays table view of pending submissions
- Features:
  - Priority indicators
  - Progress tracking
  - Status badges
  - Pagination
  - Lock status display
  - Click to view detail

**`src/components/page-sections/admin/SubmissionDetail.jsx`**
- Detailed view of a single submission
- Features:
  - Submission header with metadata
  - Statistics cards (total, pending, in progress, complete, unavailable)
  - Lock/unlock functionality
  - Folder organization
  - Item cards with material details
  - Faculty notes display

### 4. Styles
**`src/css/SubmissionWorkflow.css`**
- Complete styling for submission workflow components
- Responsive design for mobile and desktop
- Priority indicators, progress bars, status badges
- Folder and item card styling
- Loading and empty states

## Files Modified

### 1. API Configuration
**`src/config/api.config.js`**
- Added `submissionWorkflow` endpoint configuration:
  - `pendingSubmissions: '/submission-workflow/pending-submissions'`
  - `submissionDetail: '/submission-workflow/submission/:id'`
  - `lockSubmission: '/faculty-submission/:uuid/lock'`
  - `unlockSubmission: '/faculty-submission/:uuid/unlock'`

### 2. Admin Page
**`src/pages/Admin.jsx`**
- Added `canManageSubmissions` permission check
- Added "Process Submissions" tab to desktop navigation
- Added "Process Submissions" to mobile dropdown
- Added tab content section that renders `<SubmissionQueue />`
- Integrated submissions into permission-based tab routing

### 3. Routing
**`src/components/layout/AppRoutes.jsx`**
- Added protected route for submission detail view:
  - `/admin/submissions/:submissionId` → `<SubmissionDetail />`

## API Integration

### Endpoints Used

1. **GET /submission-workflow/pending-submissions**
   - Query params: `page`, `per_page`
   - Returns: Paginated list of submissions with metadata

2. **GET /submission-workflow/submission/{id}**
   - Path param: `submissionId` (numeric ID)
   - Returns: Detailed submission with all items, folders, and metadata

3. **POST /faculty-submission/{uuid}/lock**
   - Path param: `submissionUuid` (UUID)
   - Body: `{ lock_reason: string }`
   - Returns: Lock confirmation

4. **POST /faculty-submission/{uuid}/unlock**
   - Path param: `submissionUuid` (UUID)
   - Returns: Unlock confirmation

## Data Flow

### Queue View
1. User navigates to Admin → Process Submissions tab
2. `SubmissionQueue` component mounts
3. `useEffect` triggers `fetchPendingSubmissions(1, 20)`
4. Store calls `submissionWorkflowService.getPendingSubmissions()`
5. Service fetches from API and formats each submission
6. Store updates `submissions` state
7. Component renders table with formatted data
8. User can click "View" to navigate to detail page

### Detail View
1. User clicks "View" on a submission
2. Router navigates to `/admin/submissions/{id}`
3. `SubmissionDetail` component mounts with `submissionId` from URL params
4. `useEffect` triggers `fetchSubmissionDetail(submissionId)`
5. Store calls `submissionWorkflowService.getSubmissionDetail()`
6. Service fetches from API and formats detail data
7. Store updates `selectedSubmission` state
8. Component renders submission header, statistics, folders, and items
9. User can lock/unlock submission
10. Lock/unlock triggers API call and refreshes detail view

## Permission System

New permission: `manage_submissions`
- Allows access to the "Process Submissions" tab
- Required to view submission queue
- Required to view submission details
- Required to lock/unlock submissions

Admins automatically have this permission through `isAdmin` flag.

## Features Implemented

✅ Queue view with pagination
✅ Priority indicators (urgent, high, normal)
✅ Progress tracking with percentage
✅ Status badges (submitted, in_progress, complete, unavailable)
✅ Lock status display
✅ Submission detail view
✅ Statistics cards
✅ Folder organization
✅ Item cards with metadata
✅ Lock/unlock functionality
✅ Responsive design
✅ Error handling
✅ Loading states
✅ Empty states
✅ Back navigation

## Not Yet Implemented (Future Enhancements)

The backend guide mentioned these endpoints that are not yet implemented:

⏳ `PUT /submission-workflow/item/{itemId}` - Update item status
⏳ `POST /submission-workflow/submission/{uuid}/internal-note` - Staff-only notes
⏳ `GET /submission-workflow/stats` - Dashboard statistics

When these endpoints are available, you can add:
- Status update buttons on individual items
- Staff notes/comments section
- Dashboard statistics view

## Usage

### For Admins
1. Log in with admin credentials
2. Navigate to Admin panel
3. Click "Process Submissions" tab
4. View list of pending submissions
5. Click "View" on any submission to see details
6. Lock submission to start processing
7. Review items organized by folders
8. Process items (status updates coming in future enhancement)
9. Unlock when complete

### For Staff with Limited Permissions
1. Request `manage_submissions` permission from admin
2. Follow same workflow as admins

## Testing Checklist

- [ ] Queue loads with pagination
- [ ] Priority indicators display correctly
- [ ] Progress bars show accurate percentages
- [ ] Clicking "View" navigates to detail page
- [ ] Detail page loads submission data
- [ ] Statistics cards show correct counts
- [ ] Folders display items in correct order
- [ ] Lock button works and shows locked status
- [ ] Unlock button works and clears lock
- [ ] Back button returns to queue
- [ ] Error states display properly
- [ ] Loading states display properly
- [ ] Empty state displays when no submissions
- [ ] Mobile responsive design works
- [ ] Permission checks prevent unauthorized access

## Notes

- The service uses numeric `submission_id` for detail endpoint (not UUID)
- All item metadata is stored as JSON in `resource_data` field
- Folders are organized alphabetically
- Items within folders are sorted by `position_in_folder`
- Unfoldered items are sorted by `display_order`
- Priority calculation considers `needed_by_date` and days since submission
- Lock status prevents multiple staff from editing simultaneously

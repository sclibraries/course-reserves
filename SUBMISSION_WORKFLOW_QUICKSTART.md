# Quick Start Guide - Faculty Submission Processing

## For Developers

### Running the Application

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

### Testing the New Feature

1. **Log in as an admin user** (or a user with `manage_submissions` permission)

2. **Navigate to Admin Panel**
   - Click "Admin" in the navigation
   - You should see the "Process Submissions" tab

3. **View Submission Queue**
   - Click "Process Submissions" tab
   - You'll see a table of all pending submissions
   - Each row shows:
     - Priority (urgent/high/normal)
     - Course code and title
     - Faculty name
     - Term
     - Submission date
     - Number of items
     - Progress bar
     - Status
     - Assignment

4. **View Submission Detail**
   - Click the "View" button on any submission
   - You'll navigate to `/admin/submissions/{id}`
   - See detailed information including:
     - Course metadata
     - Statistics cards
     - Items organized by folders
     - Individual item details

5. **Lock/Unlock Submission**
   - On the detail page, click "Lock & Process"
   - The submission becomes locked (shown with lock icon)
   - Click "Unlock" to release the lock

### Using the Hook

If you want to use the submission workflow in a custom component:

```javascript
import { useSubmissionWorkflow } from '../hooks/useSubmissionWorkflow';

function MyComponent() {
  const {
    submissions,
    loading,
    error,
    fetchPendingSubmissions,
    getOverallStatistics
  } = useSubmissionWorkflow();

  useEffect(() => {
    fetchPendingSubmissions(1, 20);
  }, []);

  const stats = getOverallStatistics();

  return (
    <div>
      <h2>Total Submissions: {stats.totalSubmissions}</h2>
      <h3>Total Items: {stats.totalItems}</h3>
      {/* ... */}
    </div>
  );
}
```

## API Configuration

The service connects to:
```
BASE_URL: https://libtools2.smith.edu/course-reserves/backend/web
```

Endpoints:
- `GET /submission-workflow/pending-submissions?page={page}&per_page={perPage}`
- `GET /submission-workflow/submission/{id}`
- `POST /faculty-submission/{uuid}/lock`
- `POST /faculty-submission/{uuid}/unlock`

### Authentication

All requests require authentication via Bearer token stored in `localStorage.authToken`.

## Adding New Permissions

To grant submission management access to a staff user:

1. Go to Admin → User Management
2. Find the user
3. Add the `manage_submissions` permission
4. User will now see the "Process Submissions" tab

## Customizing the Feature

### Adding New Filters

Edit `src/components/page-sections/admin/SubmissionQueue.jsx`:

```javascript
// Add filter state
const [statusFilter, setStatusFilter] = useState('all');

// Filter submissions
const filteredSubmissions = submissions.filter(sub => 
  statusFilter === 'all' || sub.status === statusFilter
);

// Render filter dropdown
<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
  <option value="all">All</option>
  <option value="submitted">Submitted</option>
  <option value="in_progress">In Progress</option>
  <option value="complete">Complete</option>
</select>
```

### Adding Item Status Updates (Future)

When the backend implements `PUT /submission-workflow/item/{itemId}`:

```javascript
// Add to submissionWorkflowService.js
async updateItemStatus(itemId, status) {
  const response = await fetch(
    `${API_BASE}/submission-workflow/item/${itemId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': this.getAuthToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    }
  );
  return await response.json();
}

// Add to store
updateItemStatus: async (itemId, status) => {
  await submissionWorkflowService.updateItemStatus(itemId, status);
  // Refresh the current submission
  const { selectedSubmission } = get();
  if (selectedSubmission) {
    await get().fetchSubmissionDetail(selectedSubmission.submission.id);
  }
}
```

### Customizing Styles

All styles are in `src/css/SubmissionWorkflow.css`. Key classes:

- `.submission-queue` - Main queue container
- `.submissions-table` - Queue table
- `.submission-detail` - Detail view container
- `.stat-card` - Statistics cards
- `.folder-section` - Folder containers
- `.item-card` - Individual item cards
- `.priority-indicator` - Priority badges

## Troubleshooting

### "Access Restricted" Message
- Check that your user has `manage_submissions` permission or is an admin
- Verify authentication token is valid

### Submissions Not Loading
- Check browser console for API errors
- Verify backend is running and accessible
- Check that the API endpoint URL is correct in the service

### Lock Not Working
- Verify the backend endpoint for locking is implemented
- Check that you're using the UUID (not numeric ID) for lock operations
- Look for error messages in the console

### Pagination Not Working
- Check that `_meta` object is present in API response
- Verify pagination parameters are being sent correctly

## Next Steps

Once these backend endpoints are implemented, you can add:

1. **Item Status Updates**
   - Add status dropdown to each item card
   - Call `updateItemStatus` on change
   - Show success/error messages

2. **Staff Notes**
   - Add notes section to submission detail
   - Implement note form and submission
   - Display existing notes with timestamps

3. **Dashboard Statistics**
   - Create new dashboard component
   - Fetch stats from new endpoint
   - Display charts and graphs

## Support

For questions or issues:
1. Check the implementation summary: `SUBMISSION_WORKFLOW_IMPLEMENTATION.md`
2. Review the integration guide from backend team
3. Check browser console for error messages
4. Verify API responses in Network tab

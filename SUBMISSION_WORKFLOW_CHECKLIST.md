# Faculty Submission Workflow - Testing & Deployment Checklist

## Pre-Testing Setup

### Environment Setup
- [ ] Node modules installed (`npm install`)
- [ ] Development server starts without errors (`npm run dev`)
- [ ] Backend API is accessible
- [ ] Backend endpoints are deployed and functional
- [ ] Authentication system is working

### User Setup
- [ ] Admin user account exists
- [ ] Test staff user account exists
- [ ] `manage_submissions` permission is configured in database
- [ ] Test user has `manage_submissions` permission assigned

## Feature Testing

### Queue View Tests

#### Initial Load
- [ ] Navigate to `/admin?tab=submissions`
- [ ] Page loads without errors
- [ ] Submissions table displays
- [ ] If no submissions: Empty state message shows
- [ ] If submissions exist: Data displays in table

#### Data Display
- [ ] Priority indicators show (urgent/high/normal)
- [ ] Course codes display correctly
- [ ] Course titles display correctly
- [ ] Faculty names display correctly
- [ ] Terms display correctly
- [ ] Submission dates format correctly (e.g., "2 days ago")
- [ ] Item counts show in badges
- [ ] Progress bars display with percentages
- [ ] Status badges show with correct colors
- [ ] Assigned staff shows (or "Unassigned")
- [ ] Lock icons appear for locked submissions

#### Pagination
- [ ] Pagination controls appear if > 20 submissions
- [ ] "Next" button navigates to page 2
- [ ] "Previous" button disabled on page 1
- [ ] "Next" button disabled on last page
- [ ] Page numbers display correctly
- [ ] Clicking page number loads that page
- [ ] Data updates when changing pages

#### Navigation
- [ ] "View" button exists on each row
- [ ] Clicking "View" navigates to detail page
- [ ] Browser back button returns to queue
- [ ] Page remembers pagination state

#### Responsive Design
- [ ] Desktop view (>768px): Full table displays
- [ ] Mobile view (<768px): Dropdown navigation works
- [ ] Mobile view: Table is horizontally scrollable or stacks
- [ ] All elements are readable on small screens

### Detail View Tests

#### Initial Load
- [ ] Navigate to `/admin/submissions/{id}` directly
- [ ] Page loads without errors
- [ ] Submission data displays
- [ ] Invalid ID shows "not found" message
- [ ] Loading spinner appears during fetch

#### Header Section
- [ ] Course code displays
- [ ] Course title displays
- [ ] Section displays (if exists)
- [ ] Faculty name displays
- [ ] Term displays
- [ ] Submission date displays
- [ ] Status badge displays
- [ ] "Back to Queue" button works

#### Lock Status
- [ ] Unlocked submissions show "Lock & Process" button
- [ ] Locked submissions show lock warning alert
- [ ] Lock alert shows who locked and when
- [ ] Lock reason displays in alert
- [ ] "Unlock" button appears for locked submissions

#### Statistics Cards
- [ ] Total Items count is correct
- [ ] Pending count is correct
- [ ] In Progress count is correct
- [ ] Complete count is correct
- [ ] Unavailable count is correct
- [ ] Progress percentage is correct
- [ ] Statistics update after lock/unlock

#### Folder Organization
- [ ] Folders display with folder icon
- [ ] Folder names display correctly
- [ ] Item count badge shows on each folder
- [ ] Items within folders are sorted by position
- [ ] Folders are sorted alphabetically

#### Item Display
- [ ] Item titles display
- [ ] Authors display (if present)
- [ ] Barcodes display (if present)
- [ ] Call numbers display (if present)
- [ ] Material types display
- [ ] Status badges display
- [ ] Priority badges display
- [ ] "Reuse" indicators show for reused items
- [ ] Faculty notes display (if present)

#### Unfoldered Items
- [ ] Unfoldered items section appears (if items exist)
- [ ] Items sorted by display_order
- [ ] All item data displays correctly

### Lock/Unlock Functionality

#### Locking
- [ ] Click "Lock & Process" button
- [ ] Button triggers API call
- [ ] Loading state shows during API call
- [ ] Success: Lock status updates
- [ ] Success: Button changes to "Unlock"
- [ ] Success: Lock alert appears
- [ ] Error: Error message displays
- [ ] Error: State doesn't change

#### Unlocking
- [ ] Click "Unlock" button
- [ ] Button triggers API call
- [ ] Loading state shows during API call
- [ ] Success: Lock status clears
- [ ] Success: Button changes to "Lock & Process"
- [ ] Success: Lock alert disappears
- [ ] Error: Error message displays
- [ ] Error: State doesn't change

### Error Handling

#### Network Errors
- [ ] Disconnect from network
- [ ] Try to load queue
- [ ] Error message displays
- [ ] Error is user-friendly
- [ ] Reconnect and retry works

#### API Errors
- [ ] Backend returns 500 error
- [ ] Error message displays
- [ ] Error doesn't crash app
- [ ] User can dismiss error

#### Not Found Errors
- [ ] Navigate to `/admin/submissions/99999`
- [ ] "Not found" message displays
- [ ] "Back to Queue" button works

#### Authentication Errors
- [ ] Clear auth token
- [ ] Try to access queue
- [ ] Redirects to login
- [ ] After login, can access queue

### Permission Tests

#### Admin Access
- [ ] Log in as admin
- [ ] "Process Submissions" tab visible
- [ ] Can access queue
- [ ] Can access detail view
- [ ] Can lock/unlock submissions

#### Staff with Permission
- [ ] Log in as staff with `manage_submissions`
- [ ] "Process Submissions" tab visible
- [ ] Can access queue
- [ ] Can access detail view
- [ ] Can lock/unlock submissions

#### Staff without Permission
- [ ] Log in as staff without `manage_submissions`
- [ ] "Process Submissions" tab NOT visible
- [ ] Direct URL to queue shows access denied
- [ ] Direct URL to detail shows access denied
- [ ] Other tabs still accessible

#### Unauthenticated User
- [ ] Log out
- [ ] Try to access `/admin?tab=submissions`
- [ ] Redirects to login
- [ ] After login, redirects back

## Code Quality Tests

### Linting
- [ ] Run `npm run lint` (or equivalent)
- [ ] No errors reported
- [ ] No warnings for new files

### Type Checking (if using TypeScript)
- [ ] Run type checker
- [ ] No type errors

### Console Errors
- [ ] Open browser console
- [ ] Navigate through feature
- [ ] No console errors
- [ ] No console warnings (or only expected ones)

## Performance Tests

### Load Time
- [ ] Queue loads in < 2 seconds
- [ ] Detail loads in < 2 seconds
- [ ] No UI blocking during loads

### Memory
- [ ] Open/close detail page 10 times
- [ ] Check browser memory usage
- [ ] No memory leaks detected

### Smooth Interactions
- [ ] Clicking buttons responds immediately
- [ ] Hover states work smoothly
- [ ] Transitions are smooth
- [ ] No janky animations

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] Chrome Mobile (latest)
- [ ] Safari Mobile (latest)

## Accessibility Tests

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activate buttons
- [ ] Focus indicators visible
- [ ] No keyboard traps

### Screen Reader
- [ ] Test with screen reader
- [ ] All buttons have labels
- [ ] Images have alt text
- [ ] Tables have proper headers

### Color Contrast
- [ ] Text meets WCAG AA standards
- [ ] Status badges readable
- [ ] Priority indicators distinguishable

## Integration Tests

### With Existing Features
- [ ] Other admin tabs still work
- [ ] User management unaffected
- [ ] Course management unaffected
- [ ] Resource management unaffected
- [ ] Reports unaffected

### Navigation
- [ ] Header navigation works
- [ ] Breadcrumbs work (if applicable)
- [ ] Browser back/forward buttons work
- [ ] URL state syncs with UI

## Edge Cases

### Data Edge Cases
- [ ] Submission with 0 items
- [ ] Submission with 100+ items
- [ ] Submission with very long course title
- [ ] Submission with no faculty name
- [ ] Submission with special characters
- [ ] Submission with null/undefined fields

### UI Edge Cases
- [ ] Very long item titles wrap correctly
- [ ] Empty folders display correctly
- [ ] Multiple users locking same submission
- [ ] Rapidly clicking lock/unlock
- [ ] Switching tabs during API call

## Documentation Review

- [ ] Implementation doc is clear
- [ ] Quick start guide is accurate
- [ ] Architecture diagram makes sense
- [ ] Code comments are helpful
- [ ] API endpoints documented

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] No console errors
- [ ] Documentation complete
- [ ] Permission system configured

### Deployment
- [ ] Build production bundle (`npm run build`)
- [ ] No build errors
- [ ] Test production build locally
- [ ] Deploy to staging environment
- [ ] Test on staging
- [ ] Deploy to production

### Post-Deployment
- [ ] Test on production
- [ ] Monitor error logs
- [ ] Check API performance
- [ ] Verify user access
- [ ] Gather feedback

## Known Limitations

Document any current limitations:

- [ ] Item status updates not yet implemented (waiting for backend)
- [ ] Staff notes not yet implemented (waiting for backend)
- [ ] Dashboard statistics not yet implemented (waiting for backend)
- [ ] Filters not yet implemented (optional enhancement)
- [ ] Sorting not yet implemented (optional enhancement)
- [ ] Search not yet implemented (optional enhancement)

## Future Enhancements Backlog

- [ ] Add filtering by status
- [ ] Add filtering by priority
- [ ] Add sorting options
- [ ] Add search functionality
- [ ] Add bulk operations
- [ ] Add export to CSV
- [ ] Add email notifications
- [ ] Add activity log
- [ ] Add dashboard with statistics
- [ ] Add assignment workflow
- [ ] Add status change tracking
- [ ] Add communication history

## Support & Maintenance

### Contact Information
- Frontend Developer: [Your Name]
- Backend Developer: [Backend Team]
- Documentation: See README files

### Issue Tracking
- [ ] Create GitHub/Jira issues for bugs
- [ ] Create issues for enhancements
- [ ] Prioritize issues
- [ ] Assign to developers

### Monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor API performance
- [ ] Track user adoption
- [ ] Collect user feedback

---

## Sign-Off

### Development Team
- [ ] Frontend Developer Sign-Off: _________________ Date: _______
- [ ] Backend Developer Sign-Off: _________________ Date: _______
- [ ] QA Sign-Off: _________________ Date: _______

### Stakeholders
- [ ] Product Owner Sign-Off: _________________ Date: _______
- [ ] Library Staff Sign-Off: _________________ Date: _______
- [ ] IT Manager Sign-Off: _________________ Date: _______

---

**Notes:**
Use this checklist to systematically test the feature before deployment.
Mark items as complete as you test them.
Document any issues found and their resolutions.

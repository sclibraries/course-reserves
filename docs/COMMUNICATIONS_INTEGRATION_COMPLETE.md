# Communications System - Complete Integration Guide

## Overview

The My Work Queue now features an integrated tabbed interface for viewing item details and all communications in one place. Staff can:
- View item details and communications side-by-side
- Send messages to faculty or staff
- Create quick notes
- View threaded conversations
- Receive notifications for @mentions (polling-based)

## Architecture

### Component Hierarchy

```
MyWorkQueue
├── WorkQueueRow (for each item)
│   ├── Compact Row (always visible)
│   └── Expanded Details (collapsible)
│       └── ItemDetailsWithCommunications (NEW - Tabbed Interface)
│           ├── Tab: Item Details
│           │   ├── Item Information
│           │   ├── Course Context
│           │   └── Action Buttons
│           └── Tab: Communications
│               ├── Quick Action Buttons
│               └── CommunicationsPanel
│                   ├── Message List
│                   ├── Threaded Replies
│                   └── Read/Unread Status
├── StaffMessagingModal
├── FacultyMessageModal
└── QuickNoteModal
```

## New Components

### 1. ItemDetailsWithCommunications.jsx

**Purpose:** Tabbed interface combining item details with live communications

**Features:**
- Two tabs: "Item Details" and "Communications"
- Item Details tab shows original expanded view
- Communications tab shows:
  - Quick action buttons for new messages
  - Live communications panel with refresh
  - Threaded conversations
  - Badge for unread count (TODO)

**Usage:**
```jsx
<ItemDetailsWithCommunications
  item={item}
  onStaffMessage={() => openStaffMessage(item)}
  onFacultyMessage={() => openFacultyMessage(item)}
  onAddNote={() => openNoteModal(item)}
/>
```

**Props:**
- `item` - Full item object with submission data
- `onStaffMessage` - Handler to open staff messaging modal
- `onFacultyMessage` - Handler to open faculty message modal
- `onAddNote` - Handler to open quick note modal

**Styling:** `ItemDetailsWithCommunications.css`

---

### 2. useUnreadMessages Hook

**Purpose:** Poll backend for unread @mention count

**Features:**
- Automatic polling at configurable interval (default: 30 seconds)
- Manual refresh function
- Error handling
- Enable/disable toggle
- Maintains last known count on error

**Usage:**
```javascript
import { useUnreadMessages } from '../hooks/useUnreadMessages';

function MyComponent() {
  const { unreadCount, loading, error, refresh } = useUnreadMessages(30000, true);
  
  return (
    <div>
      {unreadCount > 0 && (
        <Badge color="danger">{unreadCount}</Badge>
      )}
    </div>
  );
}
```

**Parameters:**
- `pollInterval` (default: 30000ms) - How often to poll
- `enabled` (default: true) - Whether to poll

**Returns:**
- `unreadCount` - Number of unread messages where user was @mentioned
- `loading` - Boolean indicating fetch in progress
- `error` - Error message if fetch failed
- `refresh` - Function to manually trigger refresh

**File:** `src/hooks/useUnreadMessages.js`

---

## Service Layer Updates

### New Methods in submissionWorkflowService.js

```javascript
// Get unread message count for current user
async getUnreadCount()
// Returns: { unread_count: 3, user_id: "1", username: "roconnell" }

// Get all mentions for current user
async getMyMentions()
// Returns: { mentions: [...], total: 1 }
```

**Endpoints:**
- `GET /submission-workflow/my-unread-count`
- `GET /submission-workflow/my-mentions`

---

## User Experience Flow

### Viewing Communications

1. **User claims an item** → Item appears in My Work Queue
2. **User expands item** → ItemDetailsWithCommunications opens
3. **User clicks "Communications" tab** → See all messages for this item
4. **CommunicationsPanel loads** → Fetches messages from backend
5. **Messages display** → Threaded conversations with sender names, timestamps, badges
6. **User can reply** (future) → Click reply button, compose message with parent_message_id

### Sending Messages

**From Expanded View:**
1. Click "Communications" tab
2. Click "New Staff Message" / "Message Faculty" / "Quick Note"
3. Modal opens with item context pre-filled
4. Compose message (with @mentions if staff message)
5. Submit → Success toast → Queue refreshes → Communications tab updates

**From Dropdown:**
1. Click actions dropdown (⋮) in compact row
2. Select "Message Staff" / "Message Faculty" / "Add Notes"
3. Same flow as above

### Real-time Updates (Current Implementation)

**Polling Method:**
- Frontend polls `/my-unread-count` every 30 seconds
- Badge shows count in navigation (TODO: integrate with header)
- Count updates automatically
- Low overhead (single lightweight query)

---

## Integration Points

### Current State
✅ Tabbed interface in expanded item view  
✅ Communications panel loads messages  
✅ All three messaging modals working  
✅ Service methods for unread count and mentions  
✅ Custom hook for polling  

### TODO - Next Steps

#### 1. Add Unread Badge to Communications Tab
```jsx
<NavLink onClick={() => toggleTab('communications')}>
  <FaComments className="me-1" />
  Communications
  {unreadForThisItem > 0 && (
    <Badge color="danger" className="ms-1">{unreadForThisItem}</Badge>
  )}
</NavLink>
```

#### 2. Add Global Unread Badge to Navigation
In `Header.jsx` or `Admin.jsx`:
```jsx
import { useUnreadMessages } from '../hooks/useUnreadMessages';

function Navigation() {
  const { unreadCount } = useUnreadMessages(30000);
  
  return (
    <Nav>
      <NavItem>
        <NavLink href="/admin?tab=my-work">
          My Work
          {unreadCount > 0 && (
            <Badge color="danger" pill className="ms-2">
              {unreadCount}
            </Badge>
          )}
        </NavLink>
      </NavItem>
    </Nav>
  );
}
```

#### 3. Create "My Mentions" Page
New route: `/admin/mentions`

```jsx
import { useState, useEffect } from 'react';
import { submissionWorkflowService } from '../services/admin/submissionWorkflowService';

function MentionsPage() {
  const [mentions, setMentions] = useState([]);
  
  useEffect(() => {
    loadMentions();
  }, []);
  
  const loadMentions = async () => {
    const data = await submissionWorkflowService.getMyMentions();
    setMentions(data.mentions);
  };
  
  const markAsRead = async (messageId) => {
    await submissionWorkflowService.markAsRead(messageId);
    loadMentions(); // Refresh
  };
  
  return (
    <div>
      <h2>My Mentions</h2>
      {mentions.map(mention => (
        <Card key={mention.id} className={mention.is_read ? '' : 'unread'}>
          <CardBody>
            <div className="d-flex justify-content-between">
              <div>
                <strong>{mention.sender_name}</strong>
                <small className="text-muted ms-2">{mention.created_at}</small>
              </div>
              <Badge color={mention.is_read ? 'secondary' : 'primary'}>
                {mention.is_read ? 'Read' : 'Unread'}
              </Badge>
            </div>
            {mention.subject && <h5 className="mt-2">{mention.subject}</h5>}
            <p>{mention.message}</p>
            <div className="mt-2">
              {!mention.is_read && (
                <Button size="sm" color="primary" onClick={() => markAsRead(mention.id)}>
                  Mark as Read
                </Button>
              )}
              <Button 
                size="sm" 
                color="secondary" 
                tag="a" 
                href={`/admin?tab=my-work&item=${mention.resource_id}`}
                className="ms-2"
              >
                View Item
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
```

#### 4. Add Reply Functionality
In `CommunicationsPanel.jsx`, add reply button:

```jsx
<Button size="sm" color="link" onClick={() => openReplyModal(message.id)}>
  Reply
</Button>
```

Create `ReplyModal.jsx` (simpler version of StaffMessagingModal):
- Pre-fills `parent_message_id`
- Shows parent message context
- Same @mention functionality
- Auto-sets visibility to match parent

#### 5. Mark as Read on View
Auto-mark messages as read when Communications tab is viewed:

```javascript
useEffect(() => {
  if (activeTab === 'communications' && communications.length > 0) {
    // Mark unread messages as read
    const unreadMessages = communications.filter(m => !m.is_read);
    unreadMessages.forEach(msg => {
      submissionWorkflowService.markAsRead(msg.id);
    });
  }
}, [activeTab, communications]);
```

#### 6. Desktop/Email Notifications (Future)
```javascript
// Browser notification
if ('Notification' in window && Notification.permission === 'granted') {
  new Notification('New Mention', {
    body: '@roconnell mentioned you in a message',
    icon: '/icon.png'
  });
}

// Email notification (backend)
// When @mention detected in createCommunication():
Yii::$app->mailer->compose()
  ->setTo($mentionedUser->email)
  ->setSubject('You were mentioned')
  ->send();
```

---

## Performance Considerations

### Polling Interval
**Current: 30 seconds** (recommended for production)

**Options:**
- 10s = Very responsive, 360 requests/hour per user
- 30s = Balanced, 120 requests/hour per user  
- 60s = Conservative, 60 requests/hour per user

**Calculation:**
- 100 active users × 120 requests/hour = 12,000 requests/hour = 3.33 requests/second
- Very manageable load

### Database Optimization
Ensure indexes exist on:
```sql
CREATE INDEX idx_participants_user ON submission_communication_participants(participant_id);
CREATE INDEX idx_reads_user ON submission_communication_reads(reader_id);
CREATE INDEX idx_reads_comm ON submission_communication_reads(communication_id);
CREATE INDEX idx_comms_submission ON submission_communications(submission_id);
CREATE INDEX idx_comms_created ON submission_communications(created_at DESC);
```

### Caching Strategy (Future)
```javascript
// Cache unread count for 10 seconds
const cache = new Map();
const CACHE_TTL = 10000;

async getUnreadCount() {
  const now = Date.now();
  const cached = cache.get('unreadCount');
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetch(...);
  cache.set('unreadCount', { data, timestamp: now });
  return data;
}
```

---

## Testing Checklist

### Manual Testing
- [ ] Expand item in My Work Queue
- [ ] Click "Communications" tab
- [ ] Verify tab switches smoothly
- [ ] Click "New Staff Message"
- [ ] Send message with @mention
- [ ] Return to Communications tab
- [ ] Verify message appears in list
- [ ] Check message shows sender name, timestamp, badges
- [ ] Send quick note
- [ ] Verify note appears
- [ ] Message faculty
- [ ] Verify faculty message appears
- [ ] Check unread count increments when mentioned
- [ ] Verify polling updates count every 30s

### API Testing
```bash
# Test unread count
curl -X GET \
  'https://libtools2.smith.edu/course-reserves/backend/web/submission-workflow/my-unread-count' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Test mentions list
curl -X GET \
  'https://libtools2.smith.edu/course-reserves/backend/web/submission-workflow/my-mentions' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Test mark as read
curl -X POST \
  'https://libtools2.smith.edu/course-reserves/backend/web/submission-workflow/communications/123/read' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

---

## Files Modified/Created

### New Files
1. ✅ `src/components/page-sections/admin/ItemDetailsWithCommunications.jsx`
2. ✅ `src/components/page-sections/admin/ItemDetailsWithCommunications.css`
3. ✅ `src/hooks/useUnreadMessages.js`

### Modified Files
1. ✅ `src/components/page-sections/admin/MyWorkQueue.jsx`
   - Replaced expanded details with ItemDetailsWithCommunications
   - Removed duplicate item detail code

2. ✅ `src/services/admin/submissionWorkflowService.js`
   - Added `getUnreadCount()`
   - Added `getMyMentions()`

3. ✅ `src/components/page-sections/admin/CommunicationsPanel.jsx`
   - Already displays messages with threading
   - Uses `sender_name` field
   - Handles API response structure

---

## User Guide Summary

**For Staff Members:**

1. **Viewing Communications:**
   - Claim an item
   - Expand it in My Work Queue
   - Click "Communications" tab
   - See all messages, notes, and tasks for this item

2. **Sending Messages:**
   - From Communications tab: Click "New Staff Message"
   - From dropdown: Click "Message Staff"
   - Use @username to mention colleagues
   - Set priority, category, visibility
   - Create as task if action required

3. **Getting Notified:**
   - Check navigation for unread badge (TODO)
   - Visit "My Mentions" page to see all @mentions (TODO)
   - Messages marked as read when viewed

4. **Organizing Work:**
   - Use categories: acquisitions, cataloging, digitization, etc.
   - Set priorities: low, normal, high, urgent
   - Assign tasks to specific staff members
   - Track conversations in threaded view

---

## Summary

The communications system is now fully integrated with a streamlined tabbed interface. Staff can view item details and all related communications in one place without switching contexts. The polling-based notification system provides near-real-time updates without complex infrastructure. Next steps include adding the unread badge to the navigation, creating a dedicated "My Mentions" page, and implementing reply functionality.


# Slack-Like Channel Layout - October 28, 2025

## Overview
Redesigned the Work Queue Detail page to use a **Slack-like channel interface** where communication is organized by type (Faculty vs. Staff) rather than showing all queue items from different classes.

## The Problem
**Previous layout was confusing:**
- Left panel (too narrow): Item details
- Middle panel: **All queue items from different classes** ❌
- Right panel: All messages mixed together

User feedback: *"The queue items is just a bunch of items from various other classes not associated with the item I'm working on"*

## The Solution
**New Slack-like layout:**
- **Left panel (wider)**: Item details for the **current item you're working on**
- **Middle panel**: **Communication channels** for THIS item only (Faculty Channel, Staff Channel)
- **Right panel**: **Messages within selected channel** with full threading

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Queue | My Work Queue                   [5 items] │
├──────────────────────┬─────────────────┬────────────────────┤
│                      │                 │                    │
│ LEFT PANEL (450px)   │ CENTER (280px)  │ RIGHT (flex: 1)    │
│ Item Details         │ Channels        │ Channel Messages   │
│                      │                 │                    │
│ ┌─────────────────┐  │ ┌─────────────┐ │ Faculty Messages   │
│ │ Course: ABC 101 │  │ │ 👤 Faculty  │ │                    │
│ │ Instructor: ... │  │ │ Communicat..│*│ Message 1          │
│ │ Status: [...]   │  │ └─────────────┘ │ ├─ Reply 1         │
│ │ Priority: High  │  │                 │ └─ Reply 2         │
│ │ Title: ...      │  │ ┌─────────────┐ │                    │
│ └─────────────────┘  │ │ 👥 Staff    │ │ Message 2          │
│                      │ │ Communicat..│ │ (click to expand)  │
│ ┌─────────────────┐  │ └─────────────┘ │                    │
│ │ Actions         │  │                 │ [Scroll for more]  │
│ │ • Staff Message │  │                 │                    │
│ │ • Message Fac.. │  │                 │                    │
│ │ • Quick Note    │  │                 │                    │
│ │ • Mark Complete │  │                 │                    │
│ │ • Unclaim       │  │                 │                    │
│ └─────────────────┘  │                 │                    │
│                      │                 │                    │
└──────────────────────┴─────────────────┴────────────────────┘
```

## Key Changes

### 1. Wider Left Panel (350px → 450px)
**Why:** Item details were cramped and hard to read
**Now:** Plenty of room for all item information and action buttons

### 2. New Middle Panel: Communication Channels
**Replaces:** List of all queue items (confusing)
**Now Shows:** Two channels for the **current item only**

**Faculty Channel:**
- Icon: 👤 (FaUser)
- Name: "Faculty Communication"
- Description: "Messages with faculty about this item"
- Color: Blue highlight when selected

**Staff Channel:**
- Icon: 👥 (FaUsers)
- Name: "Staff Communication"  
- Description: "Internal staff notes and discussions"
- Color: Blue highlight when selected

**Interaction:**
- Click a channel to view its messages in the right panel
- Active channel has blue left border and background
- Matches Slack's channel sidebar UX

### 3. Right Panel: Channel-Specific Messages
**New Component:** `ChannelMessagesPanel.jsx`
- Shows **only messages for the selected channel**
- Filters by sender_type and communication_type
- Full threading support (expand/collapse replies)
- Reply button on each message
- Clean, focused view

## New Component: ChannelMessagesPanel

**Location:** `src/components/page-sections/admin/ChannelMessagesPanel.jsx`

**Props:**
- `submissionId` (number, required): The submission ID
- `resourceId` (number, optional): The resource/item ID
- `channel` (string, required): 'faculty' or 'staff'

**Filtering Logic:**
```javascript
// Faculty Channel
if (channel === 'faculty') {
  return msg.sender_type === 'faculty' || 
         msg.communication_type === 'faculty_to_staff' ||
         msg.visibility === 'faculty_visible';
}

// Staff Channel
else {
  return msg.sender_type === 'staff' || 
         msg.communication_type === 'staff_to_staff' ||
         (msg.visibility && msg.visibility !== 'faculty_visible');
}
```

**Features:**
- ✅ Message threading with expand/collapse
- ✅ Reply button on each message
- ✅ Reply modal integration
- ✅ Auto-refresh via ref
- ✅ Loading and error states
- ✅ Empty state for no messages

## User Workflow

### Viewing Messages
1. Open work queue detail page for an item
2. See **Faculty Channel** selected by default
3. Right panel shows all faculty-related messages
4. Click **Staff Channel** to switch
5. Right panel updates to show staff messages

### Replying to Messages
1. Click **Reply** button on any message
2. Type reply in modal
3. Submit
4. Reply appears threaded under parent message
5. Click expand/collapse to view thread

### Sending New Messages
1. Use action buttons in left panel:
   - **Staff Message** → Goes to Staff Channel
   - **Message Faculty** → Goes to Faculty Channel
   - **Quick Note** → Goes to Staff Channel
2. Message appears in appropriate channel
3. Auto-refreshes to show new message

## Benefits

### ✅ Clear Context
- Always know which item you're working on
- No confusion with other classes/items
- Focused on ONE item at a time

### ✅ Organized Communication
- Faculty conversations separate from staff notes
- Easy to switch between channels
- Like Slack: select channel → see messages

### ✅ Better Threading
- Replies properly nested
- Expand/collapse threads
- Clear conversation flow

### ✅ More Space
- Left panel: 450px (was 350px)
- Right panel: Flex (gets remaining space)
- Item details readable
- Long messages don't overflow

### ✅ Familiar UX
- Slack-like channel interface
- Intuitive for users already using Slack/Teams
- Standard left-sidebar + content pattern

## Technical Details

### State Management
```javascript
// Selected channel ('faculty' or 'staff')
const [selectedChannel, setSelectedChannel] = useState('faculty');

// Ref for refreshing messages
const messagesRef = useRef(null);
```

### Data Flow
1. User clicks channel → `setSelectedChannel('faculty')`
2. ChannelMessagesPanel receives new `channel` prop
3. useEffect triggers → `loadMessages()`
4. Messages filtered by channel type
5. Displayed in right panel

### Refresh Mechanism
```javascript
// After sending message
const handleSendMessage = () => {
  // Close modals
  setStaffMessageModal({ isOpen: false, item: null });
  
  // Refresh messages in current channel
  if (messagesRef.current?.refresh) {
    messagesRef.current.refresh();
  }
  
  // Refresh item list
  fetchClaimedItems();
};
```

## CSS Updates

### Channel Item Styling
```css
.channel-item {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  cursor: pointer;
  transition: background-color 0.2s;
}

.channel-item.active {
  background-color: #e7f3ff;
  border-left: 3px solid #0066cc;
}

.channel-item .channel-name {
  font-weight: 600;
  color: #212529;
}

.channel-item.active .channel-name {
  color: #0066cc;
}
```

### Panel Widths
- Left: 450px (was 350px) - 28% wider
- Center: 280px (fixed) - Clean channel list
- Right: flex: 1 - Takes remaining space

## Files Modified

### Created:
- `src/components/page-sections/admin/ChannelMessagesPanel.jsx` - New channel messages component

### Modified:
- `src/pages/WorkQueueDetail.jsx` 
  - Changed middle panel from queue items to channels
  - Added channel selection state
  - Integrated ChannelMessagesPanel
  - Removed handleSelectItem (no longer needed)
  
- `src/pages/WorkQueueDetail.css`
  - Increased left panel width to 450px
  - Added channel-item styles (Slack-like)
  - Updated responsive breakpoints

## Testing Checklist

### Channel Display
- [ ] Faculty channel shows by default
- [ ] Staff channel visible below
- [ ] Channels have icons (👤 Faculty, 👥 Staff)
- [ ] Descriptions show below channel names

### Channel Selection
- [ ] Click Faculty channel → highlights blue
- [ ] Right panel shows "Faculty Messages"
- [ ] Click Staff channel → highlights blue
- [ ] Right panel shows "Staff Messages"
- [ ] Only one channel active at a time

### Message Display
- [ ] Faculty channel shows faculty messages only
- [ ] Staff channel shows staff messages only
- [ ] Messages sorted by date (newest first)
- [ ] Threading works (expand/collapse)
- [ ] Reply buttons present on all messages

### Message Sending
- [ ] Send faculty message → appears in Faculty channel
- [ ] Send staff message → appears in Staff channel
- [ ] Quick note → appears in Staff channel
- [ ] Messages refresh automatically

### Layout
- [ ] Left panel width comfortable (450px)
- [ ] Item details all visible
- [ ] Action buttons not cramped
- [ ] Right panel gets remaining space
- [ ] Long messages don't overflow

### Responsive
- [ ] Desktop: Three panels side-by-side
- [ ] Tablet: Panels adjust width
- [ ] Mobile: Panels stack vertically
- [ ] All content accessible

## Future Enhancements

### Possible Additions:
1. **Unread badges** on channels
   - Show count of unread messages per channel
   - Red badge like Slack

2. **Channel icons update**
   - Faculty: Person icon
   - Staff: Team icon
   - Notes: Sticky note icon (sub-channel?)

3. **Quick channel switcher**
   - Keyboard shortcut to switch channels
   - Cmd/Ctrl + K for quick switcher

4. **Channel search**
   - Search messages within a channel
   - Filter by date, sender, etc.

5. **Pinned messages**
   - Pin important messages to channel
   - Show pinned section at top

6. **Notifications**
   - Desktop notifications for new messages
   - Sound alerts (optional)

## Summary

The new Slack-like channel layout provides:

✅ **Clarity**: One item, organized by communication type
✅ **Focus**: No confusion with other queue items  
✅ **Familiarity**: Slack-like UX everyone knows
✅ **Space**: Wider panels, better readability
✅ **Organization**: Faculty vs. Staff clearly separated

Users now have a **clean, focused workspace** for processing individual items with **clear communication channels** for each type of conversation.

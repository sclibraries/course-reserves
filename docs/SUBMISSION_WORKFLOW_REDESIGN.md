# Submission Workflow Redesign - Enhanced Processing System

## Overview
Complete redesign of the faculty submission processing workflow to support:
- Staff ownership and assignment
- Material-type-specific workflows
- Department handoffs
- Integrated communication (@mentions)
- Connection to existing AdminElectronicResources system

---

## 1. Staff Assignment & Ownership

### Assignment System

**Database Changes Needed:**
```sql
-- Add to submission_new_resources table
ALTER TABLE submission_new_resources 
ADD COLUMN assigned_to_user_id INT NULL,
ADD COLUMN claimed_at DATETIME NULL,
ADD COLUMN claimed_by_user_id INT NULL,
ADD FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
ADD FOREIGN KEY (claimed_by_user_id) REFERENCES users(id);

-- Track assignment history
CREATE TABLE submission_item_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  assigned_from_user_id INT NULL,
  assigned_to_user_id INT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  FOREIGN KEY (item_id) REFERENCES submission_new_resources(id),
  FOREIGN KEY (assigned_from_user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
);
```

### UI Components

**ItemCard Changes:**
```jsx
<ItemCard>
  <ItemHeader>
    <DisplayNumber>1.1</DisplayNumber>
    <ItemTitle>Book Title</ItemTitle>
    
    {/* Assignment Badge */}
    <AssignmentBadge>
      {item.claimed_by ? (
        <Badge color="info">
          <FaUser /> {item.claimed_by_name}
        </Badge>
      ) : (
        <Button size="sm" onClick={handleClaim}>
          <FaClaim /> Claim
        </Button>
      )}
    </AssignmentBadge>
    
    {/* Quick Actions */}
    <DropdownMenu>
      <DropdownItem onClick={() => handleAssign(item)}>
        <FaUserPlus /> Assign to...
      </DropdownItem>
      <DropdownItem onClick={() => handleHandoff(item)}>
        <FaExchange /> Hand off...
      </DropdownItem>
    </DropdownMenu>
  </ItemHeader>
  
  {/* Rest of item content */}
</ItemCard>
```

**Assignment Modal:**
- Search staff members by name
- Filter by department (Reserves, Acquisitions, Collections)
- Optional assignment reason
- Sends notification to assigned person

---

## 2. Status Management - Quick Dropdown

### Replace Modal with Inline Status Dropdown

**Before:** Click "Update Status" → Modal opens → Multiple fields → Save
**After:** Click status badge → Dropdown appears → Select new status → Done

```jsx
<StatusDropdown>
  <DropdownToggle caret color={getStatusColor(item.status)}>
    {getStatusLabel(item.status)}
  </DropdownToggle>
  <DropdownMenu>
    <DropdownItem onClick={() => updateStatus('pending')}>
      ⏳ Pending
    </DropdownItem>
    <DropdownItem onClick={() => updateStatus('in_progress')}>
      ⚙️ In Progress
    </DropdownItem>
    <DropdownItem onClick={() => updateStatus('complete')}>
      ✅ Complete
    </DropdownItem>
    <DropdownItem onClick={() => updateStatus('unavailable')}>
      ❌ Unavailable
    </DropdownItem>
    <DropdownItem divider />
    <DropdownItem onClick={() => openNotesModal()}>
      📝 Add Notes...
    </DropdownItem>
  </DropdownMenu>
</StatusDropdown>
```

---

## 3. Integrated Communication System

### Two-Channel Communication

**Faculty Communication** - Traditional messages visible to faculty
**Staff Communication** - Slack-style with @mentions, only visible internally

### Database Schema

```sql
-- Extend existing communications table
ALTER TABLE submission_communications
ADD COLUMN communication_type ENUM('faculty', 'staff') DEFAULT 'faculty',
ADD COLUMN mentioned_users JSON NULL COMMENT 'Array of mentioned user IDs',
ADD COLUMN thread_id INT NULL COMMENT 'For threaded conversations',
ADD COLUMN is_system_message BOOLEAN DEFAULT FALSE;

-- Mentions tracking for notifications
CREATE TABLE submission_communication_mentions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  communication_id INT NOT NULL,
  mentioned_user_id INT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME NULL,
  FOREIGN KEY (communication_id) REFERENCES submission_communications(id),
  FOREIGN KEY (mentioned_user_id) REFERENCES users(id)
);
```

### UI Components

**Communication Panel (Split View):**
```jsx
<CommunicationPanel>
  <Tabs>
    <Tab title="Faculty Messages">
      <FacultyMessageThread />
      <ComposeMessage 
        type="faculty"
        placeholder="Message visible to faculty member..."
      />
    </Tab>
    
    <Tab title="Staff Discussion" badge={unreadStaffMessages}>
      <StaffMessageThread>
        {messages.map(msg => (
          <Message>
            <Avatar user={msg.sender} />
            <MessageContent>
              <strong>@{msg.sender.username}</strong>
              <MessageText>
                {parseWithMentions(msg.message)}
              </MessageText>
              <Timestamp>{msg.created_at}</Timestamp>
            </MessageContent>
          </Message>
        ))}
      </StaffMessageThread>
      
      <ComposeMessage 
        type="staff"
        placeholder="Message staff... Type @ to mention"
        onMention={handleMentionSearch}
        mentionableUsers={staffUsers}
      />
    </Tab>
  </Tabs>
</CommunicationPanel>
```

**@Mention Autocomplete:**
- Type `@` to trigger search
- Filter users by name/username
- Shows avatar and department
- Inserts mention token `@[userId:username]`
- Backend parses and creates mention records

---

## 4. Material-Type-Specific Workflows

### Workflow Definitions

Each material type gets its own processing workflow with specific states and actions.

```javascript
// Workflow configurations
const WORKFLOWS = {
  PHYSICAL_BOOK: {
    name: 'Physical Book',
    states: [
      'pending',
      'checking_catalog',
      'item_located',
      'needs_acquisition',
      'in_cataloging',
      'on_reserve',
      'unavailable'
    ],
    actions: {
      checking_catalog: [
        { label: 'Item Found', nextState: 'item_located' },
        { label: 'Need to Order', nextState: 'needs_acquisition', handoff: 'acquisitions' },
        { label: 'Send to Cataloging', nextState: 'in_cataloging', handoff: 'collections' }
      ],
      item_located: [
        { label: 'Place on Reserve', nextState: 'on_reserve' },
        { label: 'Item Not Available', nextState: 'unavailable' }
      ],
      needs_acquisition: [
        { label: 'Ordered', note: 'Add order details' },
        { label: 'Cannot Order', nextState: 'unavailable' }
      ]
    }
  },
  
  ELECTRONIC_ARTICLE: {
    name: 'Electronic Article',
    states: [
      'pending',
      'checking_access',
      'access_confirmed',
      'needs_copyright',
      'needs_purchase',
      'link_added',
      'unavailable'
    ],
    actions: {
      checking_access: [
        { label: 'In EBSCO', nextState: 'access_confirmed' },
        { label: 'Need Copyright Check', nextState: 'needs_copyright', handoff: 'collections' },
        { label: 'Need to Purchase', nextState: 'needs_purchase', handoff: 'acquisitions' }
      ],
      access_confirmed: [
        { label: 'Add to Course Page', action: 'addToAdminResources' },
        { label: 'Link Added', nextState: 'link_added' }
      ]
    }
  },
  
  VIDEO_DVD: {
    name: 'Video/DVD',
    states: [
      'pending',
      'checking_catalog',
      'needs_digitization',
      'checking_panopto',
      'digitization_requested',
      'streaming_available',
      'unavailable'
    ],
    actions: {
      checking_catalog: [
        { label: 'DVD Located', note: 'Add location' },
        { label: 'Check Panopto', nextState: 'checking_panopto' },
        { label: 'Need to Digitize', nextState: 'needs_digitization' }
      ],
      needs_digitization: [
        { label: 'Request Digitization', nextState: 'digitization_requested', handoff: 'media_services' },
        { label: 'Cannot Digitize', nextState: 'unavailable' }
      ],
      checking_panopto: [
        { label: 'Found in Panopto', nextState: 'streaming_available' },
        { label: 'Not Available', nextState: 'needs_digitization' }
      ]
    }
  },
  
  STREAMING_VIDEO: {
    name: 'Streaming Video',
    states: [
      'pending',
      'checking_subscriptions',
      'access_confirmed',
      'needs_trial',
      'needs_purchase',
      'link_added',
      'unavailable'
    ],
    actions: {
      checking_subscriptions: [
        { label: 'Access Confirmed', nextState: 'access_confirmed' },
        { label: 'Request Trial', nextState: 'needs_trial', handoff: 'acquisitions' },
        { label: 'Need to Purchase', nextState: 'needs_purchase', handoff: 'acquisitions' }
      ]
    }
  }
};
```

### Workflow UI Component

```jsx
<WorkflowProgress item={item}>
  {/* Current State */}
  <CurrentState>
    <StateIcon state={item.workflow_state} />
    <StateName>{getStateName(item.workflow_state)}</StateName>
  </CurrentState>
  
  {/* Available Actions based on current state */}
  <ActionButtons>
    {getAvailableActions(item.material_type, item.workflow_state).map(action => (
      <ActionButton
        key={action.label}
        onClick={() => handleWorkflowAction(item, action)}
        color={action.color}
      >
        {action.icon} {action.label}
      </ActionButton>
    ))}
  </ActionButtons>
  
  {/* Workflow History */}
  <WorkflowHistory>
    {item.state_changes.map(change => (
      <HistoryItem>
        <Avatar user={change.user} />
        <span>{change.from_state} → {change.to_state}</span>
        <Timestamp>{change.changed_at}</Timestamp>
      </HistoryItem>
    ))}
  </WorkflowHistory>
</WorkflowProgress>
```

---

## 5. Department Handoffs

### Built-in Handoff Buttons

Instead of manual emails, explicit handoff actions with auto-assignment and notifications.

```jsx
<HandoffButtons>
  <ButtonGroup>
    <Button 
      color="warning" 
      onClick={() => handoffTo('acquisitions')}
    >
      <FaShoppingCart /> Send to Acquisitions
    </Button>
    
    <Button 
      color="info" 
      onClick={() => handoffTo('collections')}
    >
      <FaBookOpen /> Send to Collections
    </Button>
    
    <Button 
      color="secondary" 
      onClick={() => handoffTo('media_services')}
    >
      <FaVideo /> Send to Media Services
    </Button>
  </ButtonGroup>
</HandoffButtons>
```

### Handoff Flow:

1. **Reserves Staff** clicks "Send to Acquisitions"
2. **System:**
   - Changes state to `needs_acquisition`
   - Assigns to acquisitions team lead (or leaves in acq queue)
   - Creates staff message: "@acquisitions_lead This item needs to be ordered"
   - Sends email notification
   - Removes from reserves queue, adds to acquisitions queue

3. **Acquisitions Staff** processes:
   - Can see item in their queue filtered by `needs_acquisition` state
   - Marks as "Ordered" with order details
   - Clicks "Return to Reserves" when done
   - System assigns back to original reserves staff
   - Creates message: "Item ordered, PO#12345. Expected delivery: 2 weeks"

### Database Schema

```sql
-- Handoff tracking
CREATE TABLE submission_item_handoffs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  from_department VARCHAR(50),
  to_department VARCHAR(50) NOT NULL,
  handoff_reason TEXT,
  handed_off_by_user_id INT NOT NULL,
  handed_off_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_by_user_id INT NULL,
  accepted_at DATETIME NULL,
  returned_at DATETIME NULL,
  return_note TEXT,
  FOREIGN KEY (item_id) REFERENCES submission_new_resources(id),
  FOREIGN KEY (handed_off_by_user_id) REFERENCES users(id),
  FOREIGN KEY (accepted_by_user_id) REFERENCES users(id)
);
```

---

## 6. Integration with AdminElectronicResources

### The FOLIO Course Verification Problem

**Current Issue:** Can't access AdminElectronicResources until course exists in FOLIO

**Solution:** Split-screen workflow where staff can:
1. Verify course in FOLIO
2. Process items in submission workflow
3. Directly add to AdminElectronicResources once verified

### UI Proposal: Split-Screen View

```jsx
<SubmissionDetailLayout>
  <LeftPanel width="60%">
    <SubmissionItemsList>
      {/* Current item processing view */}
    </SubmissionItemsList>
  </LeftPanel>
  
  <RightPanel width="40%">
    {!courseVerified ? (
      <CourseVerificationPanel>
        <h4>Step 1: Verify Course in FOLIO</h4>
        <FOLIOCourseSearch 
          courseInfo={submission.course}
          onCourseFound={handleCourseVerified}
        />
        <Button onClick={handleCreateInFOLIO}>
          Create Course in FOLIO
        </Button>
      </CourseVerificationPanel>
    ) : (
      <AdminResourcesPanel>
        <h4>Add to Course Page</h4>
        <CourseInfo course={folioCourse} />
        
        {/* Mini version of AdminElectronicResources */}
        <ResourceList resources={courseResources} />
        
        {/* Drag items from left panel or click "Add" button */}
        <AddResourceButton 
          onClick={() => addToCourse(selectedItem)}
        >
          Add Selected Item to Course
        </AddResourceButton>
      </AdminResourcesPanel>
    )}
  </RightPanel>
</SubmissionDetailLayout>
```

### Integration Flow:

1. **Staff opens submission detail**
2. **Right panel** shows: "Verify course in FOLIO first"
3. **Staff searches/creates** FOLIO course
4. **System** links submission to FOLIO course ID
5. **Right panel** switches to mini AdminElectronicResources
6. **Staff** can now:
   - Process item in left panel (check access, add notes)
   - Click "Add to Course" button
   - System creates resource in AdminElectronicResources
   - Item status auto-updates to "Added to Course Page"

### API Endpoint Needed:

```javascript
POST /submission-workflow/item/{itemId}/add-to-course
{
  "folio_course_id": "abc123",
  "offering_id": 456,
  "resource_data": {
    // transformed item data
  }
}

// Response includes:
{
  "success": true,
  "resource_id": 789,
  "course_resource_id": 1011,
  "item_updated": true
}
```

---

## Implementation Priority

### Phase 1: Core Improvements (Week 1)
- [ ] Replace modal with status dropdown
- [ ] Add claim/assignment system
- [ ] Basic staff communication tab

### Phase 2: Workflows (Week 2)
- [ ] Define material-type workflows
- [ ] Implement workflow state machine
- [ ] Add workflow-specific actions

### Phase 3: Handoffs (Week 3)
- [ ] Department handoff buttons
- [ ] Handoff tracking
- [ ] Department-specific queues

### Phase 4: Integration (Week 4)
- [ ] FOLIO course verification
- [ ] Split-screen layout
- [ ] Direct add to AdminElectronicResources

### Phase 5: Polish (Week 5)
- [ ] @mention system
- [ ] Notification system
- [ ] Workflow analytics dashboard

---

## Questions for Clarification

1. **User Roles:** What departments/roles exist?
   - Reserves Staff (primary)
   - Acquisitions
   - Collections/Cataloging
   - Media Services
   - Others?

2. **FOLIO Integration:** Do you have API access to:
   - Search for courses?
   - Create courses?
   - Check item availability?

3. **Material Types:** Complete list needed?
   - Physical books
   - Electronic articles
   - DVDs/Physical videos
   - Streaming videos
   - Audio materials
   - Other?

4. **Permissions:** Who can:
   - Claim items?
   - Assign items?
   - Hand off to other departments?
   - Add to AdminElectronicResources?

5. **Notifications:** Preferred channels?
   - Email
   - In-app only
   - Both?

---

## Next Steps

Once you provide answers to the questions above, we can begin implementation. I recommend starting with Phase 1 (status dropdown, claim system, basic communication) as it provides immediate workflow improvements while we design the more complex material-type workflows.

Would you like to proceed with Phase 1, or would you prefer to design the complete workflow system first?

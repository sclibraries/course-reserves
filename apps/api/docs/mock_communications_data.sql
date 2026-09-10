-- Mock Communication Data for Testing
-- Submission ID: 15
-- Submission UUID: 11111111-1111-4111-8111-111111111111
-- Course: TST 101 - Example Course
-- Faculty: example.faculty

-- Clear existing test data (optional - uncomment if you want to reset)
-- DELETE FROM submission_communication_activity WHERE communication_id IN (SELECT id FROM submission_communications WHERE submission_id = 15);
-- DELETE FROM submission_communication_reads WHERE communication_id IN (SELECT id FROM submission_communications WHERE submission_id = 15);
-- DELETE FROM submission_communication_participants WHERE communication_id IN (SELECT id FROM submission_communications WHERE submission_id = 15);
-- DELETE FROM submission_communications WHERE submission_id = 15;

-- ============================================================================
-- Scenario 1: Faculty question about deadline (with staff response)
-- ============================================================================

INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, NULL, NULL, 'faculty_to_staff', 'faculty_visible', 'question',
    'Question about deadline',
    'Can we extend the deadline by one week? I have a few more items to add to the submission.',
    'faculty', 'example.faculty', 'Example Faculty', 'example.faculty@example.test',
    'staff', 'normal', 'resolved', 1, '2025-10-17 14:30:00', '2025-10-17 15:00:00'
);

-- Get the last inserted ID for the parent message (will be around ID 1)
SET @parent_msg_1 = LAST_INSERT_ID();

-- Staff response to the deadline question
INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, @parent_msg_1, NULL, 'staff_to_faculty', 'faculty_visible', 'update',
    NULL,
    'Yes, we can extend the deadline to January 15th. Please submit any additional items by then.',
    'staff', 'example.librarian', 'Example Librarian', 'example.librarian@example.test',
    'faculty', 'normal', 'active', 1, '2025-10-17 15:00:00', '2025-10-17 15:00:00'
);

-- ============================================================================
-- Scenario 2: Faculty reports issue with specific item (high priority)
-- ============================================================================

INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, NULL, 119, 'faculty_to_staff', 'faculty_visible', 'issue',
    'Wrong edition needed',
    'I need the 2020 edition of this book, not the 1915 edition currently listed. Students will need the updated content for their assignments.',
    'faculty', 'example.faculty', 'Example Faculty', 'example.faculty@example.test',
    'staff', 'high', 'resolved', 1, '2025-10-17 16:00:00', '2025-10-17 16:45:00'
);

SET @parent_msg_2 = LAST_INSERT_ID();

-- Staff response acknowledging the issue
INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, @parent_msg_2, 119, 'staff_to_faculty', 'faculty_visible', 'update',
    NULL,
    'Thank you for catching that! I''ve updated the record to request the 2020 edition. It''s now on order from acquisitions.',
    'staff', 'example.librarian', 'Example Librarian', 'example.librarian@example.test',
    'faculty', 'high', 'active', 1, '2025-10-17 16:30:00', '2025-10-17 16:30:00'
);

-- ============================================================================
-- Scenario 3: Faculty provides update about course change
-- ============================================================================

INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, NULL, NULL, 'faculty_to_staff', 'faculty_visible', 'update',
    'Class size increased',
    'FYI - enrollment has increased from 15 to 22 students. You may want to order additional copies of the physical items.',
    'faculty', 'example.faculty', 'Example Faculty', 'example.faculty@example.test',
    'staff', 'normal', 'active', 1, '2025-10-18 09:15:00', '2025-10-18 09:15:00'
);

SET @parent_msg_3 = LAST_INSERT_ID();

-- Staff acknowledgment
INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, @parent_msg_3, NULL, 'staff_to_faculty', 'faculty_visible', 'update',
    NULL,
    'Thanks for letting us know! I''ll adjust the copy counts accordingly.',
    'staff', 'example.librarian', 'Example Librarian', 'example.librarian@example.test',
    'faculty', 'normal', 'active', 1, '2025-10-18 10:00:00', '2025-10-18 10:00:00'
);

-- ============================================================================
-- Scenario 4: Faculty note about access (unread, no reply yet)
-- ============================================================================

INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, NULL, NULL, 'faculty_to_staff', 'faculty_visible', 'note',
    'Special access requirements',
    'Please note that Chapter 3 of the textbook should only be available for one week (Jan 20-27) due to copyright restrictions discussed with the publisher.',
    'faculty', 'example.faculty', 'Example Faculty', 'example.faculty@example.test',
    'staff', 'normal', 'active', 0, '2025-10-19 14:00:00', '2025-10-19 14:00:00'
);

-- ============================================================================
-- Scenario 5: Urgent faculty question (unread, needs response)
-- ============================================================================

INSERT INTO submission_communications (
    submission_id, parent_message_id, resource_id, communication_type, visibility, category,
    subject, message, sender_type, sender_id, sender_name, sender_email,
    recipient_type, priority, status, is_read, created_at, updated_at
) VALUES (
    15, NULL, 120, 'faculty_to_staff', 'faculty_visible', 'question',
    'Digital access not working',
    'Students are reporting they cannot access the digital version of this article. Can you check the link? Class starts Monday!',
    'faculty', 'example.faculty', 'Example Faculty', 'example.faculty@example.test',
    'staff', 'urgent', 'active', 0, '2025-10-20 08:30:00', '2025-10-20 08:30:00'
);

-- ============================================================================
-- Activity Log Entries
-- ============================================================================

-- Log for first message
INSERT INTO submission_communication_activity (
    communication_id, actor_type, actor_id, actor_name, action, action_data, created_at
) VALUES (
    @parent_msg_1, 'faculty', 'example.faculty', 'Example Faculty', 'created',
    '{"category":"question","priority":"normal","has_subject":true}',
    '2025-10-17 14:30:00'
);

INSERT INTO submission_communication_activity (
    communication_id, actor_type, actor_id, actor_name, action, created_at
) VALUES (
    @parent_msg_1, 'staff', 'example.librarian', 'Example Librarian', 'replied',
    '2025-10-17 15:00:00'
);

INSERT INTO submission_communication_activity (
    communication_id, actor_type, actor_id, actor_name, action, created_at
) VALUES (
    @parent_msg_1, 'staff', 'example.librarian', 'Example Librarian', 'resolved',
    '2025-10-17 15:01:00'
);

-- ============================================================================
-- Read Receipts
-- ============================================================================

-- Staff read receipt for first message
INSERT INTO submission_communication_reads (
    communication_id, reader_type, reader_id, reader_name, read_at
) VALUES (
    @parent_msg_1, 'staff', 'example.librarian', 'Example Librarian', '2025-10-17 14:45:00'
);

-- Faculty read receipt for staff response
INSERT INTO submission_communication_reads (
    communication_id, reader_type, reader_id, reader_name, read_at
) SELECT 
    id, 'faculty', 'example.faculty', 'Example Faculty', '2025-10-17 15:05:00'
FROM submission_communications 
WHERE parent_message_id = @parent_msg_1 
LIMIT 1;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify the data was inserted correctly:
/*
SELECT 
    c.id,
    c.subject,
    c.message,
    c.sender_name,
    c.sender_type,
    c.priority,
    c.status,
    c.category,
    c.is_read,
    c.parent_message_id,
    c.resource_id,
    c.created_at
FROM submission_communications c
WHERE c.submission_id = 15
ORDER BY c.parent_message_id IS NULL DESC, c.parent_message_id, c.created_at;
*/

-- ============================================================================
-- Test Endpoint After Inserting Data
-- ============================================================================

-- The endpoint to test (replace with actual UUID):
-- GET https://libtools2.smith.edu/course-reserves/backend/web/faculty-submission/11111111-1111-4111-8111-111111111111/communications

-- Expected response will show:
-- - 5 root messages (threads)
-- - 3 threads with replies (1 reply each)
-- - 2 threads with no replies yet (unread urgent message and special access note)
-- - Mix of priorities: normal, high, urgent
-- - Mix of statuses: resolved, active
-- - Mix of categories: question, issue, update, note

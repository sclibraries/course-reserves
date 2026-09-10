-- Add lock functionality to faculty_submissions table
-- This allows staff to lock submissions to prevent faculty edits during processing

ALTER TABLE faculty_submissions
ADD COLUMN is_locked TINYINT(1) DEFAULT 0 COMMENT 'Whether submission is locked by staff (prevents faculty edits)',
ADD COLUMN locked_at DATETIME NULL COMMENT 'When submission was locked',
ADD COLUMN locked_by_staff_id VARCHAR(255) NULL COMMENT 'Staff user who locked the submission',
ADD COLUMN lock_reason VARCHAR(500) NULL COMMENT 'Optional reason for locking';

-- Add index for performance
CREATE INDEX idx_is_locked ON faculty_submissions(is_locked);

-- Example: Lock a submission
-- UPDATE faculty_submissions 
-- SET is_locked = 1, 
--     locked_at = NOW(), 
--     locked_by_staff_id = 'staff_username',
--     lock_reason = 'Processing items for course reserves'
-- WHERE submission_id = 15;

-- Example: Unlock a submission
-- UPDATE faculty_submissions 
-- SET is_locked = 0, 
--     locked_at = NULL, 
--     locked_by_staff_id = NULL,
--     lock_reason = NULL
-- WHERE submission_id = 15;

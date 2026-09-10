-- Create submission_workflow_assignments table
-- This table tracks staff assignments for processing faculty submissions

CREATE TABLE IF NOT EXISTS `submission_workflow_assignments` (
  `assignment_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `submission_id` BIGINT UNSIGNED NOT NULL,
  `assigned_staff_user_id` VARCHAR(255) NOT NULL COMMENT 'Shibboleth user ID of assigned staff member',
  `assignment_type` ENUM('full_course', 'individual_items') NOT NULL DEFAULT 'full_course' COMMENT 'Type of assignment',
  `status` ENUM('assigned', 'in_progress', 'completed', 'on_hold') NOT NULL DEFAULT 'assigned' COMMENT 'Current status of the assignment',
  `locked_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When the staff member locked/started this assignment',
  `due_date` DATE NULL DEFAULT NULL COMMENT 'Optional deadline for completion',
  `staff_notes` TEXT NULL COMMENT 'Internal notes from staff member',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`assignment_id`),
  
  -- Foreign key to faculty_submissions
  CONSTRAINT `fk_workflow_assignment_submission`
    FOREIGN KEY (`submission_id`)
    REFERENCES `faculty_submissions` (`submission_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  
  -- Index for finding assignments by submission
  INDEX `idx_submission_id` (`submission_id`),
  
  -- Index for finding assignments by staff member
  INDEX `idx_assigned_staff` (`assigned_staff_user_id`),
  
  -- Index for finding assignments by status
  INDEX `idx_status` (`status`),
  
  -- Index for sorting by locked_at (when staff started working)
  INDEX `idx_locked_at` (`locked_at`),
  
  -- Ensure each submission can only have one active assignment
  UNIQUE KEY `unique_submission_assignment` (`submission_id`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks staff assignments for processing faculty course reserve submissions';

-- Add a relation to FacultySubmission model
-- This table allows tracking:
-- - Which staff member is assigned to which submission
-- - When they started working on it (locked_at)
-- - Current status of their work
-- - Internal notes for staff collaboration
-- - Optional due dates for time-sensitive submissions

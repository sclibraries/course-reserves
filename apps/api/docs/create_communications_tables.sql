-- Communication Tables for Course Reserves System
-- Created: October 17, 2025
-- Purpose: Enable faculty-staff and staff-staff communications about submissions and items

-- Main communications table
-- Stores all messages related to submissions
CREATE TABLE IF NOT EXISTS `submission_communications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `submission_id` BIGINT(20) UNSIGNED NOT NULL,
  `parent_message_id` INT(11) NULL,  -- For threading/replies
  `resource_id` INT(11) NULL,  -- Link to specific item if applicable
  `communication_type` VARCHAR(32) NOT NULL,  -- 'faculty_to_staff', 'staff_to_faculty', 'staff_to_staff'
  `visibility` VARCHAR(32) NOT NULL DEFAULT 'all_staff',  -- 'faculty_visible', 'staff_only', 'all_staff', 'assigned_only'
  `category` VARCHAR(64) NULL,  -- 'question', 'issue', 'update', 'task', 'acquisitions', 'cataloging', 'digitization', etc.
  `subject` VARCHAR(255) NULL,  -- Optional subject line
  `message` TEXT NOT NULL,
  `sender_type` VARCHAR(32) NOT NULL,  -- 'faculty', 'staff'
  `sender_id` VARCHAR(255) NOT NULL,  -- User ID (shibboleth or staff ID)
  `sender_name` VARCHAR(255) NULL,  -- Display name
  `sender_email` VARCHAR(255) NULL,  -- Email address
  `recipient_type` VARCHAR(32) NULL,  -- 'staff', 'faculty', 'department'
  `recipient_id` VARCHAR(255) NULL,  -- Specific recipient if applicable
  `recipient_name` VARCHAR(255) NULL,
  `department` VARCHAR(64) NULL,  -- For staff-to-staff: 'acquisitions', 'cataloging', 'reserves', etc.
  `priority` VARCHAR(16) DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'
  `status` VARCHAR(32) DEFAULT 'active',  -- 'active', 'resolved', 'archived'
  `is_read` TINYINT(1) DEFAULT 0,  -- Has recipient read it
  `is_flagged` TINYINT(1) DEFAULT 0,  -- Flagged for attention
  `is_task` TINYINT(1) DEFAULT 0,  -- Is this a task assignment
  `task_status` VARCHAR(32) NULL,  -- 'pending', 'in_progress', 'completed', 'canceled'
  `task_due_date` DATE NULL,
  `task_assignee` VARCHAR(255) NULL,  -- Staff member assigned to task
  `attachments` TEXT NULL,  -- JSON array of attachment metadata
  `metadata` TEXT NULL,  -- JSON for additional flexible data
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `read_at` TIMESTAMP NULL,
  `resolved_at` TIMESTAMP NULL,
  
  INDEX `idx_submission` (`submission_id`),
  INDEX `idx_resource` (`resource_id`),
  INDEX `idx_parent` (`parent_message_id`),
  INDEX `idx_type` (`communication_type`),
  INDEX `idx_visibility` (`visibility`),
  INDEX `idx_category` (`category`),
  INDEX `idx_sender` (`sender_id`),
  INDEX `idx_recipient` (`recipient_id`),
  INDEX `idx_department` (`department`),
  INDEX `idx_status` (`status`),
  INDEX `idx_task` (`is_task`, `task_status`),
  INDEX `idx_created` (`created_at`),
  
  CONSTRAINT `fk_comm_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions`(`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign keys after table is created (to handle self-reference and optional references)
ALTER TABLE `submission_communications`
  ADD CONSTRAINT `fk_comm_parent` FOREIGN KEY (`parent_message_id`) REFERENCES `submission_communications`(`id`) ON DELETE CASCADE;

-- Add resource foreign key only if submission_new_resources table exists
-- This allows messages about submissions without specific items
-- ALTER TABLE `submission_communications`
--   ADD CONSTRAINT `fk_comm_resource` FOREIGN KEY (`resource_id`) REFERENCES `submission_new_resources`(`id`) ON DELETE SET NULL;

-- Communication participants/watchers
-- Track who should be notified about messages in a thread
CREATE TABLE IF NOT EXISTS `submission_communication_participants` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `communication_id` INT(11) NOT NULL,
  `participant_type` VARCHAR(32) NOT NULL,  -- 'faculty', 'staff'
  `participant_id` VARCHAR(255) NOT NULL,
  `participant_name` VARCHAR(255) NULL,
  `participant_email` VARCHAR(255) NULL,
  `role` VARCHAR(32) DEFAULT 'watcher',  -- 'sender', 'recipient', 'watcher', 'assignee'
  `notification_preference` VARCHAR(32) DEFAULT 'all',  -- 'all', 'mentions', 'none'
  `is_muted` TINYINT(1) DEFAULT 0,
  `last_read_at` TIMESTAMP NULL,
  `added_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_participant` (`communication_id`, `participant_id`),
  INDEX `idx_communication` (`communication_id`),
  INDEX `idx_participant` (`participant_id`),
  
  FOREIGN KEY (`communication_id`) REFERENCES `submission_communications`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Communication read receipts
-- Track when each staff member read messages (for multi-staff awareness)
CREATE TABLE IF NOT EXISTS `submission_communication_reads` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `communication_id` INT(11) NOT NULL,
  `reader_type` VARCHAR(32) NOT NULL,  -- 'faculty', 'staff'
  `reader_id` VARCHAR(255) NOT NULL,
  `reader_name` VARCHAR(255) NULL,
  `read_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_read` (`communication_id`, `reader_id`),
  INDEX `idx_communication` (`communication_id`),
  INDEX `idx_reader` (`reader_id`),
  
  FOREIGN KEY (`communication_id`) REFERENCES `submission_communications`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log for communications
-- Track all actions taken on messages (for audit trail)
CREATE TABLE IF NOT EXISTS `submission_communication_activity` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `communication_id` INT(11) NOT NULL,
  `actor_type` VARCHAR(32) NOT NULL,  -- 'faculty', 'staff', 'system'
  `actor_id` VARCHAR(255) NOT NULL,
  `actor_name` VARCHAR(255) NULL,
  `action` VARCHAR(64) NOT NULL,  -- 'created', 'replied', 'read', 'flagged', 'resolved', 'assigned', 'status_changed', etc.
  `action_data` TEXT NULL,  -- JSON for action-specific data
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_communication` (`communication_id`),
  INDEX `idx_actor` (`actor_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created` (`created_at`),
  
  FOREIGN KEY (`communication_id`) REFERENCES `submission_communications`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add communication count cache to submissions table (optional optimization)
-- This can help with performance when displaying submission lists
-- Run this separately if the column doesn't already exist
-- ALTER TABLE `faculty_submissions` ADD COLUMN `unread_messages_count` INT(11) DEFAULT 0 AFTER `submitted_at`;
-- ALTER TABLE `faculty_submissions` ADD COLUMN `total_messages_count` INT(11) DEFAULT 0 AFTER `unread_messages_count`;

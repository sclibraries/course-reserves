-- Flexible Workflow Management System
-- Supports course-level and item-level workflows with configurable steps

-- ============================================
-- Workflow Templates (the workflow definitions)
-- ============================================
CREATE TABLE IF NOT EXISTS `workflow_templates` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `workflow_type` ENUM('course', 'item') NOT NULL COMMENT 'Type of workflow: course-level or item-level',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT 'Whether this workflow is currently active',
  `version` INT(11) DEFAULT 1 COMMENT 'Version number for tracking changes',
  `category` VARCHAR(100) COMMENT 'Category like "book", "ebook", "article", "media"',
  `trigger_conditions` JSON COMMENT 'Conditions that trigger this workflow (e.g., {"resource_type": "book"})',
  `metadata` JSON COMMENT 'Additional configuration data',
  `created_by` VARCHAR(255),
  `updated_by` VARCHAR(255),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_workflow_type` (`workflow_type`),
  INDEX `idx_is_active` (`is_active`),
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Workflow Steps (individual steps in a workflow)
-- ============================================
CREATE TABLE IF NOT EXISTS `workflow_steps` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `template_id` INT(11) NOT NULL,
  `step_key` VARCHAR(100) NOT NULL COMMENT 'Unique identifier within workflow (e.g., "check_ownership")',
  `step_name` VARCHAR(255) NOT NULL COMMENT 'Display name',
  `step_description` TEXT COMMENT 'Description of what this step does',
  `step_type` ENUM('decision', 'action', 'notification', 'assignment', 'approval') NOT NULL DEFAULT 'action',
  `sequence_order` INT(11) NOT NULL COMMENT 'Order in which steps appear',
  `is_required` TINYINT(1) DEFAULT 1 COMMENT 'Must this step be completed?',
  `is_automated` TINYINT(1) DEFAULT 0 COMMENT 'Can this step be automated?',
  `assigned_role` VARCHAR(100) COMMENT 'Role responsible for this step (e.g., "cataloger", "acquisitions")',
  `estimated_duration_minutes` INT(11) COMMENT 'Estimated time to complete',
  `instructions` TEXT COMMENT 'Instructions for staff',
  `form_fields` JSON COMMENT 'Fields to display/collect for this step',
  `metadata` JSON COMMENT 'Additional step configuration',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_step_key` (`template_id`, `step_key`),
  INDEX `idx_sequence` (`template_id`, `sequence_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Workflow Conditions (conditions that determine transitions)
-- ============================================
CREATE TABLE IF NOT EXISTS `workflow_conditions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `step_id` INT(11) NOT NULL,
  `condition_key` VARCHAR(100) NOT NULL COMMENT 'Unique key for this condition',
  `condition_label` VARCHAR(255) NOT NULL COMMENT 'Human-readable label (e.g., "Do we own this book?")',
  `condition_type` ENUM('boolean', 'choice', 'value', 'calculation') NOT NULL DEFAULT 'boolean',
  `field_name` VARCHAR(100) COMMENT 'Field name to check or update',
  `operator` VARCHAR(20) COMMENT 'Operator for evaluation: equals, contains, greater_than, etc.',
  `expected_value` VARCHAR(255) COMMENT 'Expected value for condition',
  `choices` JSON COMMENT 'Available choices for choice-type conditions: [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]',
  `default_value` VARCHAR(255) COMMENT 'Default selection',
  `validation_rules` JSON COMMENT 'Validation rules for user input',
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE CASCADE,
  INDEX `idx_step_condition` (`step_id`, `condition_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Workflow Step Transitions (how to move between steps)
-- ============================================
CREATE TABLE IF NOT EXISTS `workflow_step_transitions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `from_step_id` INT(11) NOT NULL COMMENT 'Source step',
  `to_step_id` INT(11) COMMENT 'Destination step (NULL = end workflow)',
  `condition_id` INT(11) COMMENT 'Condition that must be met',
  `condition_value` VARCHAR(255) COMMENT 'Value that triggers this transition',
  `transition_label` VARCHAR(255) COMMENT 'Label for this transition (e.g., "If Yes", "If No")',
  `priority` INT(11) DEFAULT 0 COMMENT 'Priority when multiple conditions match',
  `actions` JSON COMMENT 'Actions to perform on transition (notifications, updates, etc.)',
  `is_default` TINYINT(1) DEFAULT 0 COMMENT 'Is this the default transition?',
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`from_step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`to_step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`condition_id`) REFERENCES `workflow_conditions`(`id`) ON DELETE SET NULL,
  INDEX `idx_from_step` (`from_step_id`),
  INDEX `idx_to_step` (`to_step_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Workflow Instances (actual workflow executions)
-- ============================================
CREATE TABLE IF NOT EXISTS `workflow_instances` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `template_id` INT(11) NOT NULL,
  `template_version` INT(11) NOT NULL COMMENT 'Version of template when instantiated',
  `entity_type` ENUM('course', 'item') NOT NULL,
  `entity_id` INT(11) NOT NULL COMMENT 'ID of the course or item',
  `submission_id` BIGINT(20) UNSIGNED COMMENT 'Related faculty submission',
  `current_step_id` INT(11) COMMENT 'Current step in workflow',
  `status` ENUM('not_started', 'in_progress', 'completed', 'cancelled', 'on_hold') NOT NULL DEFAULT 'not_started',
  `progress_percentage` DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Percentage complete (0-100)',
  `assigned_to_user_id` VARCHAR(255) COMMENT 'Currently assigned staff member',
  `assigned_to_role` VARCHAR(100) COMMENT 'Currently assigned role',
  `started_at` DATETIME COMMENT 'When workflow started',
  `completed_at` DATETIME COMMENT 'When workflow completed',
  `due_date` DATETIME COMMENT 'Expected completion date',
  `priority` ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  `workflow_data` JSON COMMENT 'Data collected during workflow execution',
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`current_step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE SET NULL,
  INDEX `idx_entity` (`entity_type`, `entity_id`),
  INDEX `idx_submission` (`submission_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_assigned` (`assigned_to_user_id`),
  CONSTRAINT `fk_workflow_instances_submission` 
    FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions`(`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Workflow Step History (audit trail of step completions)
-- ============================================
CREATE TABLE IF NOT EXISTS `workflow_step_history` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `instance_id` INT(11) NOT NULL,
  `step_id` INT(11) NOT NULL,
  `step_key` VARCHAR(100) NOT NULL,
  `status` ENUM('started', 'completed', 'skipped', 'failed') NOT NULL,
  `result_data` JSON COMMENT 'Data collected/decisions made in this step',
  `condition_results` JSON COMMENT 'Results of condition evaluations',
  `notes` TEXT COMMENT 'Staff notes',
  `completed_by_user_id` VARCHAR(255),
  `completed_by_name` VARCHAR(255),
  `started_at` DATETIME,
  `completed_at` DATETIME,
  `duration_minutes` INT(11) COMMENT 'How long this step took',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_instance` (`instance_id`),
  INDEX `idx_step` (`step_id`),
  INDEX `idx_status` (`status`),
  CONSTRAINT `fk_workflow_history_instance` 
    FOREIGN KEY (`instance_id`) REFERENCES `workflow_instances`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_history_step` 
    FOREIGN KEY (`step_id`) REFERENCES `workflow_steps`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Sample Data: Book Item Workflow
-- ============================================
INSERT INTO `workflow_templates` (`name`, `description`, `workflow_type`, `category`, `is_active`, `trigger_conditions`)
VALUES (
  'Physical Book Processing',
  'Workflow for processing physical book requests',
  'item',
  'book',
  1,
  '{"resource_type": "book", "is_physical": true}'
);

SET @book_workflow_id = LAST_INSERT_ID();

-- Step 1: Check Ownership
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`, `instructions`, `form_fields`)
VALUES (
  @book_workflow_id,
  'check_ownership',
  'Check Ownership',
  'Determine if the library owns this book',
  'decision',
  1,
  'acquisitions',
  'Search the catalog to see if we own this book',
  '{"fields": [{"name": "owned", "type": "boolean", "label": "Do we own this book?", "required": true}, {"name": "catalog_url", "type": "url", "label": "Catalog Link", "required": false}]}'
);

SET @step_check_ownership = LAST_INSERT_ID();

-- Step 1 Condition: Ownership check
INSERT INTO `workflow_conditions` (`step_id`, `condition_key`, `condition_label`, `condition_type`, `field_name`, `choices`, `default_value`)
VALUES (
  @step_check_ownership,
  'ownership',
  'Do we own this book?',
  'choice',
  'owned',
  '[{"value": "yes", "label": "Yes, we own it"}, {"value": "no", "label": "No, need to acquire"}]',
  'no'
);

SET @condition_ownership = LAST_INSERT_ID();

-- Step 2a: Check Format (if owned)
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`, `instructions`)
VALUES (
  @book_workflow_id,
  'check_format',
  'Check Format',
  'Determine if this is a physical book or ebook',
  'decision',
  2,
  'cataloging',
  'Check the format in the catalog'
);

SET @step_check_format = LAST_INSERT_ID();

-- Step 2a Condition: Format check
INSERT INTO `workflow_conditions` (`step_id`, `condition_key`, `condition_label`, `condition_type`, `field_name`, `choices`)
VALUES (
  @step_check_format,
  'format',
  'What format is this?',
  'choice',
  'format',
  '[{"value": "physical", "label": "Physical Book"}, {"value": "ebook", "label": "E-Book"}, {"value": "both", "label": "Both formats available"}]'
);

SET @condition_format = LAST_INSERT_ID();

-- Step 2b: Request Purchase (if not owned)
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`, `instructions`, `form_fields`)
VALUES (
  @book_workflow_id,
  'request_purchase',
  'Request Purchase',
  'Create purchase request for this book',
  'action',
  2,
  'acquisitions',
  'Submit a purchase request through the acquisitions system',
  '{"fields": [{"name": "purchase_request_id", "type": "text", "label": "Purchase Request ID"}, {"name": "vendor", "type": "text", "label": "Preferred Vendor"}, {"name": "estimated_cost", "type": "number", "label": "Estimated Cost"}]}'
);

SET @step_request_purchase = LAST_INSERT_ID();

-- Step 3: Pull from Shelf (if physical)
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`, `instructions`, `form_fields`)
VALUES (
  @book_workflow_id,
  'pull_from_shelf',
  'Pull from Shelf',
  'Retrieve physical book from the shelf',
  'action',
  3,
  'reserves_staff',
  'Use the call number to locate and pull the book from the shelf',
  '{"fields": [{"name": "call_number", "type": "text", "label": "Call Number"}, {"name": "location", "type": "text", "label": "Location"}, {"name": "barcode", "type": "text", "label": "Barcode"}]}'
);

SET @step_pull_from_shelf = LAST_INSERT_ID();

-- Step 4: Create E-Reserve Record (if ebook)
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`, `instructions`)
VALUES (
  @book_workflow_id,
  'create_ereserve',
  'Create E-Reserve Record',
  'Create link to ebook in course reserves',
  'action',
  3,
  'cataloging',
  'Create a persistent link to the ebook resource'
);

SET @step_create_ereserve = LAST_INSERT_ID();

-- Step 5: Complete
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`)
VALUES (
  @book_workflow_id,
  'complete',
  'Complete',
  'Item processing complete',
  'action',
  100,
  'any'
);

SET @step_complete = LAST_INSERT_ID();

-- Transitions: From check_ownership
INSERT INTO `workflow_step_transitions` (`from_step_id`, `to_step_id`, `condition_id`, `condition_value`, `transition_label`, `priority`)
VALUES 
  (@step_check_ownership, @step_check_format, @condition_ownership, 'yes', 'If owned', 1),
  (@step_check_ownership, @step_request_purchase, @condition_ownership, 'no', 'If not owned', 2);

-- Transitions: From check_format
INSERT INTO `workflow_step_transitions` (`from_step_id`, `to_step_id`, `condition_id`, `condition_value`, `transition_label`, `priority`)
VALUES 
  (@step_check_format, @step_pull_from_shelf, @condition_format, 'physical', 'If physical', 1),
  (@step_check_format, @step_create_ereserve, @condition_format, 'ebook', 'If ebook', 2),
  (@step_check_format, @step_pull_from_shelf, @condition_format, 'both', 'If both formats (default to physical)', 3);

-- Transitions: From actions to complete
INSERT INTO `workflow_step_transitions` (`from_step_id`, `to_step_id`, `transition_label`, `is_default`)
VALUES 
  (@step_pull_from_shelf, @step_complete, 'Next', 1),
  (@step_create_ereserve, @step_complete, 'Next', 1),
  (@step_request_purchase, @step_complete, 'Next', 1);

-- ============================================
-- Sample Data: Course Activation Workflow
-- ============================================
INSERT INTO `workflow_templates` (`name`, `description`, `workflow_type`, `is_active`)
VALUES (
  'Course Activation',
  'Workflow for activating or reactivating a course',
  'course',
  1
);

SET @course_workflow_id = LAST_INSERT_ID();

-- Step 1: Check FOLIO
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`, `instructions`)
VALUES (
  @course_workflow_id,
  'check_folio',
  'Check FOLIO',
  'Check if course exists in FOLIO',
  'decision',
  1,
  'reserves_staff',
  'Search FOLIO to see if this course already exists'
);

SET @step_check_folio = LAST_INSERT_ID();

INSERT INTO `workflow_conditions` (`step_id`, `condition_key`, `condition_label`, `condition_type`, `field_name`, `choices`)
VALUES (
  @step_check_folio,
  'exists_in_folio',
  'Does course exist in FOLIO?',
  'choice',
  'folio_exists',
  '[{"value": "yes", "label": "Yes, exists"}, {"value": "no", "label": "No, needs creation"}]'
);

SET @condition_folio = LAST_INSERT_ID();

-- Step 2a: Create in FOLIO
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_type`, `sequence_order`, `assigned_role`)
VALUES (
  @course_workflow_id,
  'create_in_folio',
  'Create Course in FOLIO',
  'action',
  2,
  'cataloging'
);

SET @step_create_folio = LAST_INSERT_ID();

-- Step 2b: Check Reactivation
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_description`, `step_type`, `sequence_order`, `assigned_role`)
VALUES (
  @course_workflow_id,
  'check_reactivation',
  'Check Reactivation',
  'Is this course being reactivated with same resources?',
  'decision',
  2,
  'reserves_staff'
);

SET @step_check_reactivation = LAST_INSERT_ID();

INSERT INTO `workflow_conditions` (`step_id`, `condition_key`, `condition_label`, `condition_type`, `field_name`, `choices`)
VALUES (
  @step_check_reactivation,
  'same_resources',
  'Same resources as previous term?',
  'choice',
  'reactivation_type',
  '[{"value": "same", "label": "Yes, same resources"}, {"value": "different", "label": "No, different resources"}]'
);

SET @condition_reactivation = LAST_INSERT_ID();

-- Step 3: Complete
INSERT INTO `workflow_steps` (`template_id`, `step_key`, `step_name`, `step_type`, `sequence_order`)
VALUES (
  @course_workflow_id,
  'complete',
  'Course Activation Complete',
  'action',
  100
);

SET @step_course_complete = LAST_INSERT_ID();

-- Transitions for course workflow
INSERT INTO `workflow_step_transitions` (`from_step_id`, `to_step_id`, `condition_id`, `condition_value`, `transition_label`)
VALUES 
  (@step_check_folio, @step_create_folio, @condition_folio, 'no', 'If not in FOLIO'),
  (@step_check_folio, @step_check_reactivation, @condition_folio, 'yes', 'If exists in FOLIO'),
  (@step_create_folio, @step_course_complete, NULL, NULL, 'Next'),
  (@step_check_reactivation, @step_course_complete, NULL, NULL, 'Next');

COMMIT;

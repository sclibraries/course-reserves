-- Schema-only bootstrap; no application rows or credentials.
SET FOREIGN_KEY_CHECKS=0;
CREATE TABLE `_deprecated_workflow_conditions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `step_id` int(11) NOT NULL,
  `condition_key` varchar(100) NOT NULL COMMENT 'Unique key for this condition',
  `condition_label` varchar(255) NOT NULL COMMENT 'Human-readable label (e.g., "Do we own this book?")',
  `condition_type` enum('boolean','choice','value','calculation') NOT NULL DEFAULT 'boolean',
  `field_name` varchar(100) DEFAULT NULL COMMENT 'Field name to check or update',
  `operator` varchar(20) DEFAULT NULL COMMENT 'Operator for evaluation: equals, contains, greater_than, etc.',
  `expected_value` varchar(255) DEFAULT NULL COMMENT 'Expected value for condition',
  `choices` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Available choices for choice-type conditions: [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]',
  `default_value` varchar(255) DEFAULT NULL COMMENT 'Default selection',
  `validation_rules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Validation rules for user input',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_step_condition` (`step_id`,`condition_key`),
  CONSTRAINT `_deprecated_workflow_conditions_ibfk_1` FOREIGN KEY (`step_id`) REFERENCES `_deprecated_workflow_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `_deprecated_workflow_instance_steps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `instance_id` int(11) NOT NULL,
  `step_id` int(11) NOT NULL,
  `status` enum('not_started','in_progress','blocked','skipped','completed') NOT NULL DEFAULT 'not_started',
  `blocked_reason` text DEFAULT NULL,
  `skip_reason` text DEFAULT NULL,
  `assigned_to_user_id` varchar(255) DEFAULT NULL,
  `assigned_to_role` varchar(100) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `version` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_instance_step` (`instance_id`,`step_id`),
  KEY `idx_instance_status` (`instance_id`,`status`),
  KEY `fk_wis_step` (`step_id`),
  CONSTRAINT `fk_wis_instance` FOREIGN KEY (`instance_id`) REFERENCES `_deprecated_workflow_instances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wis_step` FOREIGN KEY (`step_id`) REFERENCES `_deprecated_workflow_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_deprecated_workflow_instances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_id` int(11) NOT NULL,
  `template_version` int(11) NOT NULL COMMENT 'Version of template when instantiated',
  `entity_type` enum('course','item') NOT NULL,
  `entity_id` int(11) NOT NULL COMMENT 'ID of the course or item',
  `submission_id` bigint(20) unsigned DEFAULT NULL COMMENT 'Related faculty submission',
  `current_step_id` int(11) DEFAULT NULL COMMENT 'Current step in workflow',
  `status` enum('not_started','in_progress','completed','cancelled','on_hold') NOT NULL DEFAULT 'not_started',
  `progress_percentage` decimal(5,2) DEFAULT 0.00 COMMENT 'Percentage complete (0-100)',
  `progress_mode` enum('all_steps','required_only') NOT NULL DEFAULT 'required_only',
  `assigned_to_user_id` varchar(255) DEFAULT NULL COMMENT 'Currently assigned staff member',
  `assigned_to_role` varchar(100) DEFAULT NULL COMMENT 'Currently assigned role',
  `started_at` datetime DEFAULT NULL COMMENT 'When workflow started',
  `completed_at` datetime DEFAULT NULL COMMENT 'When workflow completed',
  `due_date` datetime DEFAULT NULL COMMENT 'Expected completion date',
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `workflow_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Data collected during workflow execution',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `template_id` (`template_id`),
  KEY `current_step_id` (`current_step_id`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `idx_submission` (`submission_id`),
  KEY `idx_status` (`status`),
  KEY `idx_assigned` (`assigned_to_user_id`),
  CONSTRAINT `_deprecated_workflow_instances_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `_deprecated_workflow_templates` (`id`),
  CONSTRAINT `_deprecated_workflow_instances_ibfk_2` FOREIGN KEY (`current_step_id`) REFERENCES `_deprecated_workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_workflow_instances_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_deprecated_workflow_step_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `instance_id` int(11) NOT NULL,
  `step_id` int(11) NOT NULL,
  `step_key` varchar(100) NOT NULL,
  `status` enum('started','completed','skipped','failed','blocked','reverted','assigned') NOT NULL,
  `error_code` varchar(100) DEFAULT NULL,
  `result_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Data collected/decisions made in this step',
  `condition_results` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Results of condition evaluations',
  `notes` text DEFAULT NULL COMMENT 'Staff notes',
  `completed_by_user_id` varchar(255) DEFAULT NULL,
  `completed_by_name` varchar(255) DEFAULT NULL,
  `actor_type` enum('user','automation','system') NOT NULL DEFAULT 'user',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT NULL COMMENT 'How long this step took',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_instance` (`instance_id`),
  KEY `idx_step` (`step_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_workflow_history_instance` FOREIGN KEY (`instance_id`) REFERENCES `_deprecated_workflow_instances` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_history_step` FOREIGN KEY (`step_id`) REFERENCES `_deprecated_workflow_steps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_deprecated_workflow_step_transitions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_step_id` int(11) NOT NULL COMMENT 'Source step',
  `to_step_id` int(11) DEFAULT NULL COMMENT 'Destination step (NULL = end workflow)',
  `condition_id` int(11) DEFAULT NULL COMMENT 'Condition that must be met',
  `condition_value` varchar(255) DEFAULT NULL COMMENT 'Value that triggers this transition',
  `transition_label` varchar(255) DEFAULT NULL COMMENT 'Label for this transition (e.g., "If Yes", "If No")',
  `priority` int(11) DEFAULT 0 COMMENT 'Priority when multiple conditions match',
  `actions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Actions to perform on transition (notifications, updates, etc.)',
  `is_default` tinyint(1) DEFAULT 0 COMMENT 'Is this the default transition?',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `condition_id` (`condition_id`),
  KEY `idx_from_step` (`from_step_id`),
  KEY `idx_to_step` (`to_step_id`),
  CONSTRAINT `_deprecated_workflow_step_transitions_ibfk_1` FOREIGN KEY (`from_step_id`) REFERENCES `_deprecated_workflow_steps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `_deprecated_workflow_step_transitions_ibfk_2` FOREIGN KEY (`to_step_id`) REFERENCES `_deprecated_workflow_steps` (`id`) ON DELETE SET NULL,
  CONSTRAINT `_deprecated_workflow_step_transitions_ibfk_3` FOREIGN KEY (`condition_id`) REFERENCES `_deprecated_workflow_conditions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_deprecated_workflow_steps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_id` int(11) NOT NULL,
  `step_key` varchar(100) NOT NULL COMMENT 'Unique identifier within workflow (e.g., "check_ownership")',
  `step_name` varchar(255) NOT NULL COMMENT 'Display name',
  `step_description` text DEFAULT NULL COMMENT 'Description of what this step does',
  `step_type` enum('decision','action','notification','assignment','approval') NOT NULL DEFAULT 'action',
  `sequence_order` int(11) NOT NULL COMMENT 'Order in which steps appear',
  `is_required` tinyint(1) DEFAULT 1 COMMENT 'Must this step be completed?',
  `is_automated` tinyint(1) DEFAULT 0 COMMENT 'Can this step be automated?',
  `is_gate` tinyint(1) NOT NULL DEFAULT 0,
  `assigned_role` varchar(100) DEFAULT NULL COMMENT 'Role responsible for this step (e.g., "cataloger", "acquisitions")',
  `estimated_duration_minutes` int(11) DEFAULT NULL COMMENT 'Estimated time to complete',
  `instructions` text DEFAULT NULL COMMENT 'Instructions for staff',
  `form_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Fields to display/collect for this step',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Additional step configuration',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `depends_on` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON array of step_keys or step_ids this step requires',
  `automation_handler` varchar(150) DEFAULT NULL COMMENT 'e.g., folio.ensure_course_offering',
  `automation_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_step_key` (`template_id`,`step_key`),
  KEY `idx_sequence` (`template_id`,`sequence_order`),
  CONSTRAINT `_deprecated_workflow_steps_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `_deprecated_workflow_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_deprecated_workflow_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `workflow_type` enum('course','item') NOT NULL COMMENT 'Type of workflow: course-level or item-level',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Whether this workflow is currently active',
  `version` int(11) DEFAULT 1 COMMENT 'Version number for tracking changes',
  `category` varchar(100) DEFAULT NULL COMMENT 'Category like "book", "ebook", "article", "media"',
  `trigger_conditions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Conditions that trigger this workflow (e.g., {"resource_type": "book"})',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Additional configuration data',
  `created_by` varchar(255) DEFAULT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_workflow_type` (`workflow_type`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `backup_course_offerings_pre_fall2025` (
  `offering_id` int(11) NOT NULL AUTO_INCREMENT,
  `course_id` int(11) NOT NULL,
  `folio_course_id` varchar(255) DEFAULT NULL,
  `term_id` varchar(255) NOT NULL,
  `term_name` varchar(255) NOT NULL,
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`offering_id`),
  KEY `course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `backup_courses_orphaned` (
  `course_id` int(11) NOT NULL AUTO_INCREMENT,
  `permanent_course_uuid` char(36) DEFAULT NULL,
  `legacy_course_id` int(11) DEFAULT NULL,
  `course_name` varchar(1025) NOT NULL DEFAULT '',
  `course_number` varchar(255) NOT NULL DEFAULT '',
  `department_id` varchar(255) DEFAULT NULL,
  `department_name` varchar(255) DEFAULT NULL,
  `location_id` varchar(255) DEFAULT NULL,
  `location_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `permanent_course_uuid` (`permanent_course_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `checklist_template_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_id` int(11) NOT NULL,
  `label` varchar(255) NOT NULL,
  `help_text` text DEFAULT NULL,
  `task_order` int(11) NOT NULL,
  `optional` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_template_order` (`template_id`,`task_order`),
  CONSTRAINT `checklist_template_tasks_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `checklist_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `material_types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'e.g., ["book", "article"]',
  `format` enum('any','physical','electronic') DEFAULT 'any',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `checklist_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `college_customizations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campus_location` varchar(50) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `secondary_text` varchar(255) DEFAULT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `header_bg_color` varchar(20) DEFAULT NULL,
  `search_button_bg_color` varchar(20) DEFAULT NULL,
  `reset_button_bg_color` varchar(20) DEFAULT NULL,
  `card_bg_color` varchar(20) DEFAULT NULL,
  `card_border_color` varchar(20) DEFAULT NULL,
  `card_title_text_color` varchar(20) DEFAULT NULL,
  `card_title_font_size` varchar(20) DEFAULT NULL,
  `card_text_color` varchar(20) DEFAULT NULL,
  `card_button_bg_color` varchar(20) DEFAULT NULL,
  `records_card_title_text_color` varchar(20) DEFAULT NULL,
  `records_card_text_color` varchar(20) DEFAULT NULL,
  `records_discover_link_text` varchar(100) DEFAULT NULL,
  `records_discover_link_bg_color` varchar(20) DEFAULT NULL,
  `accordion_header_bg_color` varchar(20) DEFAULT NULL,
  `accordion_header_text_color` varchar(20) DEFAULT NULL,
  `records_discover_link_base_url` varchar(1000) DEFAULT NULL,
  `moodle_link` varchar(500) DEFAULT NULL,
  `additional_header_text` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `campus_location` (`campus_location`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `course_assignments` (
  `academic_period` varchar(20) NOT NULL,
  `course_id` varchar(50) NOT NULL,
  `course_title` varchar(500) NOT NULL,
  `smith_id` varchar(20) NOT NULL,
  `role` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`academic_period`,`course_id`,`smith_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `course_instructors` (
  `course_instructor_id` int(11) NOT NULL AUTO_INCREMENT,
  `course_id` int(11) NOT NULL,
  `instructor_id` int(11) NOT NULL,
  PRIMARY KEY (`course_instructor_id`),
  UNIQUE KEY `course_id` (`course_id`,`instructor_id`),
  KEY `instructor_id` (`instructor_id`),
  CONSTRAINT `course_instructors_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE,
  CONSTRAINT `course_instructors_ibfk_2` FOREIGN KEY (`instructor_id`) REFERENCES `instructors` (`instructor_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;



CREATE TABLE `course_offerings` (
  `offering_id` int(11) NOT NULL AUTO_INCREMENT,
  `offering_uuid` char(36) DEFAULT NULL,
  `course_id` int(11) NOT NULL,
  `folio_course_id` varchar(255) DEFAULT NULL,
  `term_id` varchar(255) NOT NULL,
  `term_name` varchar(255) NOT NULL,
  `section_name` varchar(50) NOT NULL DEFAULT '',
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`offering_id`),
  UNIQUE KEY `uniq_course_term_section` (`course_id`,`term_id`,`section_name`),
  UNIQUE KEY `uniq_folio_course` (`folio_course_id`),
  UNIQUE KEY `uniq_offering_uuid` (`offering_uuid`),
  KEY `course_id` (`course_id`),
  CONSTRAINT `fk_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `course_resources` (
  `course_resource_id` int(11) NOT NULL AUTO_INCREMENT,
  `offering_id` int(11) NOT NULL,
  `resource_id` int(11) NOT NULL,
  `order` int(11) DEFAULT 999,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `start_visibility` date DEFAULT NULL,
  `end_visibility` date DEFAULT NULL,
  `use_resource_visibility` tinyint(1) DEFAULT 0,
  `primary_link_start_visibility` date DEFAULT NULL,
  `primary_link_end_visibility` date DEFAULT NULL,
  `use_primary_link_visibility` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`course_resource_id`),
  UNIQUE KEY `course_id` (`offering_id`,`resource_id`),
  KEY `resource_id` (`resource_id`),
  CONSTRAINT `course_resources_ibfk_1` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE,
  CONSTRAINT `course_resources_ibfk_2` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`resource_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `courses` (
  `course_id` int(11) NOT NULL AUTO_INCREMENT,
  `permanent_course_uuid` char(36) DEFAULT NULL,
  `legacy_course_id` int(11) DEFAULT NULL,
  `course_name` varchar(1025) NOT NULL DEFAULT '',
  `course_number` varchar(255) NOT NULL DEFAULT '',
  `department_id` varchar(255) DEFAULT NULL,
  `department_name` varchar(255) DEFAULT NULL,
  `location_id` varchar(255) DEFAULT NULL,
  `location_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `permanent_course_uuid` (`permanent_course_uuid`),
  KEY `idx_courses_course_number` (`course_number`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `faculty_proxy_activity_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `faculty_shibboleth_id` varchar(255) NOT NULL,
  `proxy_shibboleth_id` varchar(255) NOT NULL,
  `action` varchar(100) NOT NULL COMMENT 'invited, accepted, submission_created, etc.',
  `submission_id` int(11) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `faculty_shibboleth_id` (`faculty_shibboleth_id`),
  KEY `proxy_shibboleth_id` (`proxy_shibboleth_id`),
  KEY `submission_id` (`submission_id`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `faculty_proxy_course_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `permission_id` int(11) NOT NULL,
  `folio_course_listing_id` varchar(255) NOT NULL,
  `course_title` varchar(500) DEFAULT NULL,
  `term_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_permission_course` (`permission_id`,`folio_course_listing_id`),
  CONSTRAINT `fk_proxy_course_permission` FOREIGN KEY (`permission_id`) REFERENCES `faculty_proxy_permissions` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `faculty_proxy_permissions` (
  `permission_id` int(11) NOT NULL AUTO_INCREMENT,
  `faculty_shibboleth_id` varchar(255) NOT NULL COMMENT 'The faculty member granting permission',
  `proxy_shibboleth_id` varchar(255) NOT NULL COMMENT 'The proxy being granted permission',
  `faculty_display_name` varchar(255) DEFAULT NULL,
  `proxy_display_name` varchar(255) DEFAULT NULL,
  `proxy_email` varchar(255) DEFAULT NULL,
  `permission_type` enum('full_access','view_only','specific_courses') DEFAULT 'full_access',
  `status` enum('pending','active','revoked','expired') DEFAULT 'pending',
  `invited_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `accepted_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'Optional expiration date',
  `revoked_at` timestamp NULL DEFAULT NULL,
  `invitation_token` varchar(64) DEFAULT NULL COMMENT 'Token for accepting invitation',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `unique_faculty_proxy` (`faculty_shibboleth_id`,`proxy_shibboleth_id`),
  UNIQUE KEY `invitation_token` (`invitation_token`),
  KEY `faculty_shibboleth_id` (`faculty_shibboleth_id`),
  KEY `proxy_shibboleth_id` (`proxy_shibboleth_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `faculty_submissions` (
  `submission_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_uuid` char(36) DEFAULT NULL,
  `shibboleth_user_id` varchar(255) NOT NULL,
  `proxy_shibboleth_user_id` varchar(255) DEFAULT NULL COMMENT 'Assistant submitting on behalf of faculty',
  `term_code` varchar(32) NOT NULL,
  `course_code` varchar(64) NOT NULL,
  `section` varchar(16) NOT NULL DEFAULT '',
  `course_title` varchar(500) NOT NULL,
  `folio_course_listing_id` varchar(255) DEFAULT NULL,
  `offering_id` int(11) DEFAULT NULL,
  `needed_by_date` date DEFAULT NULL,
  `status` enum('draft','submitted','in_review','partially_complete','complete','canceled') DEFAULT 'draft',
  `submission_notes` text DEFAULT NULL,
  `faculty_display_name` varchar(255) DEFAULT NULL,
  `proxy_display_name` varchar(255) DEFAULT NULL,
  `assignee_staff_user_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `submitted_at` timestamp NULL DEFAULT NULL,
  `email_confirmation_sent` tinyint(1) DEFAULT 0,
  `is_duplicate_previous` tinyint(1) DEFAULT 0 COMMENT 'Reuses all materials from previous offering',
  `duplicate_note` text DEFAULT NULL COMMENT 'Note about duplication',
  `is_locked` tinyint(1) DEFAULT 0 COMMENT 'Whether submission is locked by staff (prevents faculty edits)',
  `locked_at` datetime DEFAULT NULL COMMENT 'When submission was locked',
  `locked_by_staff_id` varchar(255) DEFAULT NULL COMMENT 'Staff user who locked the submission',
  `lock_reason` varchar(500) DEFAULT NULL COMMENT 'Optional reason for locking',
  PRIMARY KEY (`submission_id`),
  UNIQUE KEY `uniq_faculty_term_course_section` (`shibboleth_user_id`,`term_code`,`course_code`,`section`),
  UNIQUE KEY `unique_faculty_course_submission` (`shibboleth_user_id`,`term_code`,`course_code`,`section`),
  UNIQUE KEY `submission_uuid` (`submission_uuid`),
  KEY `idx_term_code` (`term_code`),
  KEY `idx_status` (`status`),
  KEY `idx_assignee` (`assignee_staff_user_id`),
  KEY `idx_folio_course_listing_id` (`folio_course_listing_id`),
  KEY `course_code` (`course_code`),
  KEY `term_code` (`term_code`),
  KEY `submitted_at` (`submitted_at`),
  KEY `idx_is_locked` (`is_locked`),
  KEY `idx_offering_id` (`offering_id`),
  CONSTRAINT `fk_faculty_submission_offering` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `folders` (
  `folder_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`folder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `institution_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `institution` varchar(255) NOT NULL,
  `permission_key` varchar(100) NOT NULL,
  `granted` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `institution_permission` (`institution`,`permission_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `instructors` (
  `instructor_id` int(11) NOT NULL AUTO_INCREMENT,
  `folio_instructor_id` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`instructor_id`),
  UNIQUE KEY `folio_instructor_id` (`folio_instructor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;



CREATE TABLE `item_checklist_tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_checklist_id` int(11) NOT NULL,
  `template_task_id` int(11) NOT NULL,
  `completed` tinyint(1) DEFAULT 0,
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` varchar(255) DEFAULT NULL COMMENT 'Shibboleth user ID who completed',
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `template_task_id` (`template_task_id`),
  KEY `idx_checklist_completion` (`item_checklist_id`,`completed`),
  CONSTRAINT `item_checklist_tasks_ibfk_1` FOREIGN KEY (`item_checklist_id`) REFERENCES `item_checklists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_checklist_tasks_ibfk_2` FOREIGN KEY (`template_task_id`) REFERENCES `checklist_template_tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `item_checklists` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_item_id` bigint(20) unsigned NOT NULL COMMENT 'References submission_new_resources.id',
  `template_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` varchar(255) DEFAULT NULL COMMENT 'Shibboleth user ID who assigned',
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` varchar(255) DEFAULT NULL COMMENT 'Shibboleth user ID who completed',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_checklist` (`submission_item_id`),
  KEY `idx_template` (`template_id`),
  KEY `idx_completed` (`completed_at`),
  CONSTRAINT `item_checklists_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates` (`id`),
  CONSTRAINT `item_checklists_ibfk_2` FOREIGN KEY (`submission_item_id`) REFERENCES `submission_new_resources` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `material_type_fields` (
  `mt_field_id` int(11) NOT NULL AUTO_INCREMENT,
  `material_type_id` int(11) NOT NULL,
  `field_name` varchar(255) NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `field_type` varchar(50) DEFAULT 'text',
  `options_json` text DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`mt_field_id`),
  KEY `material_type_id` (`material_type_id`),
  CONSTRAINT `material_type_fields_ibfk_1` FOREIGN KEY (`material_type_id`) REFERENCES `material_types` (`material_type_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `material_types` (
  `material_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`material_type_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `migration` (
  `version` varchar(180) NOT NULL,
  `apply_time` int(11) DEFAULT NULL,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `offering_links` (
  `offering_link_id` int(11) NOT NULL AUTO_INCREMENT,
  `offering_id` int(11) NOT NULL,
  `linked_offering_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`offering_link_id`),
  UNIQUE KEY `offering_id` (`offering_id`,`linked_offering_id`),
  KEY `linked_offering_id` (`linked_offering_id`),
  CONSTRAINT `offering_links_ibfk_1` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE,
  CONSTRAINT `offering_links_ibfk_2` FOREIGN KEY (`linked_offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `physical_resource_references` (
  `reference_id` int(11) NOT NULL AUTO_INCREMENT,
  `external_resource_id` varchar(255) NOT NULL,
  `resource_type` varchar(50) NOT NULL DEFAULT 'physical',
  `display_name` text NOT NULL,
  `offering_id` int(11) NOT NULL,
  `order` int(11) DEFAULT 999,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`reference_id`),
  UNIQUE KEY `external_resource_id` (`external_resource_id`,`offering_id`),
  KEY `offering_id` (`offering_id`),
  CONSTRAINT `physical_resource_references_ibfk_1` FOREIGN KEY (`offering_id`) REFERENCES `course_offerings` (`offering_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `resource_links` (
  `link_id` int(11) NOT NULL AUTO_INCREMENT,
  `resource_id` int(11) NOT NULL,
  `url` varchar(2048) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `use_proxy` tinyint(1) NOT NULL DEFAULT 0,
  `order` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `start_visibility` date DEFAULT NULL COMMENT 'When this specific link becomes visible to students',
  `end_visibility` date DEFAULT NULL COMMENT 'When this specific link stops being visible to students',
  `use_link_visibility` tinyint(1) DEFAULT 0 COMMENT 'Whether this link uses individual visibility dates',
  PRIMARY KEY (`link_id`),
  KEY `resource_id` (`resource_id`),
  KEY `idx_resource_links_visibility` (`start_visibility`,`end_visibility`,`use_link_visibility`),
  CONSTRAINT `fk_resource_links_resource` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`resource_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `resource_metadata` (
  `metadata_id` int(11) NOT NULL AUTO_INCREMENT,
  `resource_id` int(11) NOT NULL,
  `field_name` varchar(255) NOT NULL,
  `field_value` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`metadata_id`),
  KEY `resource_id` (`resource_id`),
  CONSTRAINT `resource_metadata_ibfk_1` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`resource_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `resources` (
  `resource_id` int(11) NOT NULL AUTO_INCREMENT,
  `legacy_resource_id` int(11) DEFAULT NULL,
  `name` varchar(1025) DEFAULT NULL,
  `item_url` varchar(2048) DEFAULT NULL,
  `use_proxy` tinyint(1) NOT NULL DEFAULT 0,
  `folder_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `internal_note` mediumtext DEFAULT NULL,
  `external_note` mediumtext DEFAULT NULL,
  `start_visibility` date DEFAULT NULL,
  `end_visibility` date DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `material_type_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `order` int(11) DEFAULT NULL,
  `use_primary_link_visibility` tinyint(1) DEFAULT 0,
  `primary_link_start_visibility` date DEFAULT NULL,
  `primary_link_end_visibility` date DEFAULT NULL,
  PRIMARY KEY (`resource_id`),
  KEY `material_type_id` (`material_type_id`),
  KEY `idx_resources_folder_id` (`folder_id`),
  CONSTRAINT `fk_resources_folder_id` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`folder_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `resources_ibfk_1` FOREIGN KEY (`material_type_id`) REFERENCES `material_types` (`material_type_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `resources_backup` (
  `resource_id` int(11) NOT NULL AUTO_INCREMENT,
  `legacy_resource_id` int(11) DEFAULT NULL,
  `name` varchar(1025) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_url` varchar(2048) DEFAULT NULL,
  `use_proxy` tinyint(1) NOT NULL DEFAULT 0,
  `folder_id` int(11) DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `internal_note` text DEFAULT NULL,
  `external_note` text DEFAULT NULL,
  `start_visibility` date DEFAULT NULL,
  `end_visibility` date DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `material_type_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `order` int(11) DEFAULT NULL,
  `use_primary_link_visibility` tinyint(1) DEFAULT 0,
  `primary_link_start_visibility` date DEFAULT NULL,
  `primary_link_end_visibility` date DEFAULT NULL,
  PRIMARY KEY (`resource_id`),
  KEY `material_type_id` (`material_type_id`),
  KEY `idx_resources_folder_id` (`folder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `springshare_course_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course_identifier` varchar(255) NOT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `item_description` text DEFAULT NULL,
  `permalink` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;



CREATE TABLE `springshare_courses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course_identifier` varchar(255) NOT NULL,
  `course_title` varchar(255) DEFAULT NULL,
  `creators` text DEFAULT NULL,
  `subjects` text DEFAULT NULL,
  `publisher` varchar(255) DEFAULT NULL,
  `coverage` varchar(255) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `course_url` varchar(255) DEFAULT NULL,
  `course_code` varchar(100) DEFAULT NULL,
  `last_updated` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_unique_course_identifier` (`course_identifier`),
  KEY `idx_springshare_courses_course_code` (`course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_communication_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `communication_id` int(11) NOT NULL,
  `actor_type` varchar(32) NOT NULL,
  `actor_id` varchar(255) NOT NULL,
  `actor_name` varchar(255) DEFAULT NULL,
  `action` varchar(64) NOT NULL,
  `action_data` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_communication` (`communication_id`),
  KEY `idx_actor` (`actor_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `submission_communication_activity_ibfk_1` FOREIGN KEY (`communication_id`) REFERENCES `submission_communications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_communication_participants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `communication_id` int(11) NOT NULL,
  `participant_type` varchar(32) NOT NULL,
  `participant_id` varchar(255) NOT NULL,
  `participant_name` varchar(255) DEFAULT NULL,
  `participant_email` varchar(255) DEFAULT NULL,
  `role` varchar(32) DEFAULT 'watcher',
  `notification_preference` varchar(32) DEFAULT 'all',
  `is_muted` tinyint(1) DEFAULT 0,
  `last_read_at` timestamp NULL DEFAULT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_participant` (`communication_id`,`participant_id`),
  KEY `idx_communication` (`communication_id`),
  KEY `idx_participant` (`participant_id`),
  CONSTRAINT `submission_communication_participants_ibfk_1` FOREIGN KEY (`communication_id`) REFERENCES `submission_communications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_communication_reads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `communication_id` int(11) NOT NULL,
  `reader_type` varchar(32) NOT NULL,
  `reader_id` varchar(255) NOT NULL,
  `reader_name` varchar(255) DEFAULT NULL,
  `read_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_read` (`communication_id`,`reader_id`),
  KEY `idx_communication` (`communication_id`),
  KEY `idx_reader` (`reader_id`),
  CONSTRAINT `submission_communication_reads_ibfk_1` FOREIGN KEY (`communication_id`) REFERENCES `submission_communications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_communications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` bigint(20) unsigned NOT NULL,
  `parent_message_id` int(11) DEFAULT NULL,
  `resource_id` int(11) DEFAULT NULL,
  `communication_type` varchar(32) NOT NULL,
  `visibility` varchar(32) NOT NULL DEFAULT 'all_staff',
  `category` varchar(64) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `sender_type` varchar(32) NOT NULL,
  `sender_id` varchar(255) NOT NULL,
  `sender_name` varchar(255) DEFAULT NULL,
  `sender_email` varchar(255) DEFAULT NULL,
  `recipient_type` varchar(32) DEFAULT NULL,
  `recipient_id` varchar(255) DEFAULT NULL,
  `recipient_name` varchar(255) DEFAULT NULL,
  `department` varchar(64) DEFAULT NULL,
  `priority` varchar(16) DEFAULT 'normal',
  `status` varchar(32) DEFAULT 'active',
  `is_read` tinyint(1) DEFAULT 0,
  `is_flagged` tinyint(1) DEFAULT 0,
  `is_task` tinyint(1) DEFAULT 0,
  `task_status` varchar(32) DEFAULT NULL,
  `task_due_date` date DEFAULT NULL,
  `task_assignee` varchar(255) DEFAULT NULL,
  `attachments` text DEFAULT NULL,
  `metadata` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `read_at` timestamp NULL DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_submission` (`submission_id`),
  KEY `idx_resource` (`resource_id`),
  KEY `idx_parent` (`parent_message_id`),
  KEY `idx_type` (`communication_type`),
  KEY `idx_visibility` (`visibility`),
  KEY `idx_category` (`category`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_recipient` (`recipient_id`),
  KEY `idx_department` (`department`),
  KEY `idx_status` (`status`),
  KEY `idx_task` (`is_task`,`task_status`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_comm_parent` FOREIGN KEY (`parent_message_id`) REFERENCES `submission_communications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comm_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_folders` (
  `folder_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint(20) unsigned NOT NULL,
  `folder_name` varchar(255) NOT NULL,
  `display_order` int(11) DEFAULT 999,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`folder_id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `fk_folder_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_metadata` (
  `metadata_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint(20) unsigned NOT NULL,
  `total_items` int(11) DEFAULT 0,
  `total_folders` int(11) DEFAULT 0,
  `items_in_folders` int(11) DEFAULT 0,
  `ungrouped_items` int(11) DEFAULT 0,
  `submitted_by_user_id` varchar(255) DEFAULT NULL,
  `submitted_by_username` varchar(255) DEFAULT NULL,
  `submitted_by_full_name` varchar(255) DEFAULT NULL,
  `submitted_by_email` varchar(255) DEFAULT NULL,
  `submitted_by_institution` varchar(10) DEFAULT NULL,
  `raw_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Store complete frontend payload for reference',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`metadata_id`),
  UNIQUE KEY `submission_id` (`submission_id`),
  CONSTRAINT `fk_metadata_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_new_resources` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint(20) unsigned NOT NULL,
  `material_type_id` int(11) DEFAULT NULL COMMENT 'May be determined later',
  `is_reuse` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether this item is being reused from a previous submission',
  `source_barcode` varchar(255) DEFAULT NULL COMMENT 'Barcode of item being reused',
  `source_call_number` varchar(512) DEFAULT NULL COMMENT 'Call number of item being reused',
  `source_resource_id` varchar(255) DEFAULT NULL,
  `source_folio_instance_id` varchar(255) DEFAULT NULL COMMENT 'FOLIO instance ID if available',
  `resource_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `display_order` int(11) DEFAULT 999,
  `folder_name` varchar(255) DEFAULT NULL,
  `faculty_notes` text DEFAULT NULL,
  `staff_notes` text DEFAULT NULL COMMENT 'Internal notes from staff processing this item',
  `claimed_by_staff_id` varchar(255) DEFAULT NULL COMMENT 'Shibboleth user ID of staff member who claimed this item',
  `claimed_at` timestamp NULL DEFAULT NULL COMMENT 'When the item was claimed',
  `priority` enum('high','medium','low') DEFAULT 'medium',
  `item_status` varchar(50) DEFAULT 'pending' COMMENT 'Processing status',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `position_in_folder` int(11) DEFAULT NULL COMMENT 'Order within folder (if item is in a folder)',
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  KEY `material_type_id` (`material_type_id`),
  KEY `idx_folder_order` (`folder_name`,`position_in_folder`),
  KEY `idx_is_reuse` (`is_reuse`),
  KEY `idx_source_barcode` (`source_barcode`),
  KEY `idx_source_resource_id` (`source_resource_id`),
  CONSTRAINT `fk_new_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_recovery` (
  `recovery_id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_uuid` char(36) NOT NULL,
  `recovery_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`recovery_id`),
  UNIQUE KEY `submission_uuid` (`submission_uuid`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `submission_reuse_resources` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint(20) unsigned NOT NULL,
  `source_resource_id` int(11) DEFAULT NULL COMMENT 'May be null if not yet matched',
  `barcode` varchar(255) DEFAULT NULL COMMENT 'Item barcode from catalog',
  `call_number` varchar(255) DEFAULT NULL COMMENT 'Call number from catalog',
  `display_order` int(11) DEFAULT 999,
  `folder_name` varchar(255) DEFAULT NULL,
  `faculty_notes` text DEFAULT NULL,
  `item_status` varchar(50) DEFAULT 'pending' COMMENT 'Processing status',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `position_in_folder` int(11) DEFAULT NULL COMMENT 'Order within folder (if item is in a folder)',
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  KEY `source_resource_id` (`source_resource_id`),
  KEY `barcode` (`barcode`),
  KEY `idx_folder_order` (`folder_name`,`position_in_folder`),
  CONSTRAINT `fk_reuse_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `submission_workflow_assignments` (
  `assignment_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint(20) unsigned NOT NULL,
  `assigned_staff_user_id` varchar(255) NOT NULL COMMENT 'Shibboleth user ID of assigned staff member',
  `assignment_type` enum('full_course','individual_items') NOT NULL DEFAULT 'full_course' COMMENT 'Type of assignment',
  `status` enum('assigned','in_progress','completed','on_hold') NOT NULL DEFAULT 'assigned' COMMENT 'Current status of the assignment',
  `locked_at` timestamp NULL DEFAULT NULL COMMENT 'When the staff member locked/started this assignment',
  `due_date` date DEFAULT NULL COMMENT 'Optional deadline for completion',
  `staff_notes` text DEFAULT NULL COMMENT 'Internal notes from staff member',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`assignment_id`),
  UNIQUE KEY `unique_submission_assignment` (`submission_id`),
  KEY `idx_submission_id` (`submission_id`),
  KEY `idx_assigned_staff` (`assigned_staff_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_locked_at` (`locked_at`),
  CONSTRAINT `fk_workflow_assignment_submission` FOREIGN KEY (`submission_id`) REFERENCES `faculty_submissions` (`submission_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks staff assignments for processing faculty course reserve submissions';



CREATE TABLE `tracking_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `college` varchar(50) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `course_id` varchar(50) NOT NULL,
  `term` varchar(50) NOT NULL,
  `course_name` varchar(255) DEFAULT NULL,
  `instructor` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `course_code` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_term_id` (`term`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_college` (`college`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `tracking_events_backup` (
  `id` int(11) NOT NULL DEFAULT 0,
  `college` varchar(50) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `course_id` varchar(50) NOT NULL,
  `term` varchar(50) NOT NULL,
  `course_name` varchar(255) DEFAULT NULL,
  `instructor` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `course_code` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `institution` varchar(255) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'user',
  `date_added` timestamp NOT NULL DEFAULT current_timestamp(),
  `authKey` varchar(255) DEFAULT NULL,
  `accessToken` varchar(255) DEFAULT NULL,
  `approved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

SET FOREIGN_KEY_CHECKS=1;

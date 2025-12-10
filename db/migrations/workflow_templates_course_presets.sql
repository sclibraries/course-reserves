-- ============================================================================
-- COURSE WORKFLOW TEMPLATES - PRESET EXAMPLES
-- ============================================================================
-- This file contains pre-built workflow templates for course-level processing
-- These templates should be automatically applied to incoming faculty submissions
-- ============================================================================

-- Template 1: Standard Course Processing Workflow
-- ============================================================================
-- This is the default workflow for most course submissions
-- Ends with locking the submission

INSERT INTO workflow_templates (
    name, 
    description, 
    workflow_type, 
    is_active, 
    category, 
    metadata,
    created_by
) VALUES (
    'Standard Course Processing',
    'Default workflow for processing faculty course submissions. Includes review, setup, verification, and lock.',
    'course',
    1,
    'course',
    JSON_OBJECT(
        'auto_apply', true,
        'final_actions', JSON_ARRAY(
            JSON_OBJECT('type', 'lock_submission', 'enabled', true),
            JSON_OBJECT('type', 'notify_faculty', 'enabled', true)
        )
    ),
    'system'
);

SET @template_id = LAST_INSERT_ID();

-- Step 1: Initial Review
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @template_id,
    'initial_review',
    'Initial Review',
    'Review the faculty submission for completeness and clarity',
    'action',
    1,
    1,
    0,
    'reserves_coordinator',
    10,
    'Check that all required information is present. Verify course details, instructor information, and item list completeness.'
);

SET @step1_id = LAST_INSERT_ID();

-- Condition for Step 1: Is submission complete?
INSERT INTO workflow_conditions (
    step_id,
    condition_key,
    condition_label,
    condition_type,
    choices,
    default_value
) VALUES (
    @step1_id,
    'submission_complete',
    'Is the submission complete and ready to process?',
    'choice',
    JSON_ARRAY(
        JSON_OBJECT('value', 'yes', 'label', 'Yes - Ready to process'),
        JSON_OBJECT('value', 'no', 'label', 'No - Needs clarification'),
        JSON_OBJECT('value', 'partial', 'label', 'Partial - Can start some items')
    ),
    'yes'
);

SET @condition1_id = LAST_INSERT_ID();

-- Step 2: Contact Faculty (conditional - only if incomplete)
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @template_id,
    'contact_faculty',
    'Contact Faculty',
    'Reach out to faculty for missing information or clarifications',
    'action',
    2,
    0,
    0,
    'reserves_coordinator',
    5,
    'Send communication to faculty requesting missing information. Document what is needed.'
);

SET @step2_id = LAST_INSERT_ID();

-- Step 3: Course Setup in System
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @template_id,
    'course_setup',
    'Course Setup',
    'Create or link course record in the reserves system',
    'action',
    3,
    1,
    0,
    'reserves_coordinator',
    15,
    'Search for existing course in FOLIO. Create new course record if needed. Link to faculty submission.'
);

SET @step3_id = LAST_INSERT_ID();

-- Step 4: Item Assignment
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @template_id,
    'item_assignment',
    'Assign Items to Staff',
    'Distribute items to appropriate staff members for processing',
    'assignment',
    4,
    1,
    0,
    'reserves_coordinator',
    10,
    'Review each item and assign to staff based on material type and availability. Items will have their own workflows.'
);

SET @step4_id = LAST_INSERT_ID();

-- Step 5: Quality Check
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @template_id,
    'quality_check',
    'Quality Check',
    'Verify all items are processed correctly',
    'approval',
    5,
    1,
    0,
    'reserves_coordinator',
    10,
    'Review processed items. Ensure all items are linked, metadata is correct, and access is configured.'
);

SET @step5_id = LAST_INSERT_ID();

-- Condition for Step 5: Quality check passed?
INSERT INTO workflow_conditions (
    step_id,
    condition_key,
    condition_label,
    condition_type,
    choices,
    default_value
) VALUES (
    @step5_id,
    'quality_passed',
    'Does everything look correct?',
    'choice',
    JSON_ARRAY(
        JSON_OBJECT('value', 'yes', 'label', 'Yes - All good'),
        JSON_OBJECT('value', 'no', 'label', 'No - Issues found')
    ),
    'yes'
);

SET @condition2_id = LAST_INSERT_ID();

-- Step 6: Final Approval & Lock
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @template_id,
    'final_approval',
    'Final Approval & Lock',
    'Give final approval and lock the submission',
    'approval',
    6,
    1,
    0,
    'reserves_manager',
    5,
    'Review the entire course setup. If everything is correct, approve to trigger submission lock.'
);

SET @step6_id = LAST_INSERT_ID();

-- TRANSITIONS for Standard Course Processing
-- ============================================================================

-- Step 1 -> Step 2 (if incomplete)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    condition_id,
    condition_value,
    transition_label,
    priority
) VALUES (
    @step1_id,
    @step2_id,
    @condition1_id,
    'no',
    'Submission incomplete - contact faculty',
    2
);

-- Step 1 -> Step 3 (if complete)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    condition_id,
    condition_value,
    transition_label,
    priority,
    is_default
) VALUES (
    @step1_id,
    @step3_id,
    @condition1_id,
    'yes',
    'Submission complete - proceed to setup',
    3,
    1
);

-- Step 1 -> Step 3 (if partial)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    condition_id,
    condition_value,
    transition_label,
    priority
) VALUES (
    @step1_id,
    @step3_id,
    @condition1_id,
    'partial',
    'Partial submission - proceed with available items',
    2
);

-- Step 2 -> Step 3 (after faculty contact)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    transition_label,
    is_default
) VALUES (
    @step2_id,
    @step3_id,
    'Continue to course setup',
    1
);

-- Step 3 -> Step 4
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    transition_label,
    is_default
) VALUES (
    @step3_id,
    @step4_id,
    'Continue to item assignment',
    1
);

-- Step 4 -> Step 5
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    transition_label,
    is_default
) VALUES (
    @step4_id,
    @step5_id,
    'Continue to quality check',
    1
);

-- Step 5 -> Step 4 (if issues found - loop back)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    condition_id,
    condition_value,
    transition_label,
    priority
) VALUES (
    @step5_id,
    @step4_id,
    @condition2_id,
    'no',
    'Issues found - reassign for corrections',
    2
);

-- Step 5 -> Step 6 (if passed)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    condition_id,
    condition_value,
    transition_label,
    priority,
    is_default
) VALUES (
    @step5_id,
    @step6_id,
    @condition2_id,
    'yes',
    'Quality passed - proceed to final approval',
    3,
    1
);

-- Step 6 -> NULL (end workflow and trigger lock)
INSERT INTO workflow_step_transitions (
    from_step_id,
    to_step_id,
    transition_label,
    is_default,
    actions
) VALUES (
    @step6_id,
    NULL,
    'Complete workflow and lock submission',
    1,
    JSON_OBJECT(
        'lock_submission', true,
        'notify_faculty', true
    )
);


-- ============================================================================
-- Template 2: Rush Course Processing (Expedited)
-- ============================================================================

INSERT INTO workflow_templates (
    name, 
    description, 
    workflow_type, 
    is_active, 
    category, 
    metadata,
    created_by
) VALUES (
    'Rush Course Processing',
    'Expedited workflow for urgent course requests requiring fast turnaround.',
    'course',
    1,
    'rush',
    JSON_OBJECT(
        'auto_apply', false,
        'final_actions', JSON_ARRAY(
            JSON_OBJECT('type', 'lock_submission', 'enabled', true),
            JSON_OBJECT('type', 'notify_faculty', 'enabled', true, 'priority', 'high')
        )
    ),
    'system'
);

SET @rush_template_id = LAST_INSERT_ID();

-- Rush Step 1: Immediate Triage
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @rush_template_id,
    'immediate_triage',
    'Immediate Triage',
    'Quick assessment and priority assignment',
    'action',
    1,
    1,
    0,
    'reserves_manager',
    5,
    'Assess urgency and feasibility. Assign priority to all items. Contact faculty immediately if anything is unclear.'
);

-- Rush Step 2: Fast-Track Setup
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @rush_template_id,
    'fasttrack_setup',
    'Fast-Track Course Setup',
    'Expedited course setup and item processing',
    'action',
    2,
    1,
    0,
    'reserves_coordinator',
    20,
    'Set up course and process items simultaneously. Skip standard approval steps. Focus on getting materials accessible ASAP.'
);

-- Rush Step 3: Quality Spot-Check
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @rush_template_id,
    'spot_check',
    'Quick Quality Spot-Check',
    'Brief verification that essentials are working',
    'approval',
    3,
    1,
    0,
    'reserves_coordinator',
    5,
    'Spot check a few key items. Ensure access links work. Full quality review can happen later.'
);

-- Rush Step 4: Lock & Notify
INSERT INTO workflow_steps (
    template_id,
    step_key,
    step_name,
    step_description,
    step_type,
    sequence_order,
    is_required,
    is_automated,
    assigned_role,
    estimated_duration_minutes,
    instructions
) VALUES (
    @rush_template_id,
    'lock_notify',
    'Lock & Notify Faculty',
    'Lock submission and send priority notification',
    'approval',
    4,
    1,
    0,
    'reserves_manager',
    2,
    'Lock the submission and immediately notify faculty that materials are ready.'
);

-- Rush transitions (simple linear flow)
INSERT INTO workflow_step_transitions (from_step_id, to_step_id, transition_label, is_default)
SELECT s1.id, s2.id, 'Next step', 1
FROM workflow_steps s1
INNER JOIN workflow_steps s2 ON s1.template_id = s2.template_id 
    AND s2.sequence_order = s1.sequence_order + 1
WHERE s1.template_id = @rush_template_id;

-- End of rush workflow
INSERT INTO workflow_step_transitions (from_step_id, to_step_id, transition_label, is_default)
SELECT id, NULL, 'Complete and lock', 1
FROM workflow_steps
WHERE template_id = @rush_template_id
ORDER BY sequence_order DESC
LIMIT 1;


-- ============================================================================
-- Template 3: Online Course Setup
-- ============================================================================

INSERT INTO workflow_templates (
    name, 
    description, 
    workflow_type, 
    is_active, 
    category, 
    metadata,
    created_by
) VALUES (
    'Online Course Setup',
    'Specialized workflow for online courses with emphasis on e-resources and accessibility.',
    'course',
    1,
    'online',
    JSON_OBJECT(
        'auto_apply', true,
        'trigger_conditions', JSON_OBJECT('course_format', 'online'),
        'final_actions', JSON_ARRAY(
            JSON_OBJECT('type', 'lock_submission', 'enabled', true),
            JSON_OBJECT('type', 'notify_faculty', 'enabled', true),
            JSON_OBJECT('type', 'create_lms_links', 'enabled', true)
        )
    ),
    'system'
);

SET @online_template_id = LAST_INSERT_ID();

-- Online Step 1: Review for E-Resources
INSERT INTO workflow_steps (
    template_id, step_key, step_name, step_description, step_type,
    sequence_order, is_required, is_automated, assigned_role,
    estimated_duration_minutes, instructions
) VALUES (
    @online_template_id, 'ereserves_review', 'E-Resources Review',
    'Review submission focusing on electronic resource availability',
    'action', 1, 1, 0, 'ereserves_librarian', 15,
    'Check if all requested items are available electronically. Identify physical items that need scanning or alternative sourcing.'
);

-- Online Step 2: Accessibility Check
INSERT INTO workflow_steps (
    template_id, step_key, step_name, step_description, step_type,
    sequence_order, is_required, is_automated, assigned_role,
    estimated_duration_minutes, instructions
) VALUES (
    @online_template_id, 'accessibility_check', 'Accessibility Review',
    'Ensure all materials meet accessibility standards',
    'action', 2, 1, 0, 'ereserves_librarian', 10,
    'Verify PDFs are screen-reader friendly. Check video captions. Ensure alternative formats are available where needed.'
);

-- Online Step 3: LMS Integration
INSERT INTO workflow_steps (
    template_id, step_key, step_name, step_description, step_type,
    sequence_order, is_required, is_automated, assigned_role,
    estimated_duration_minutes, instructions
) VALUES (
    @online_template_id, 'lms_integration', 'LMS Integration',
    'Configure links for Learning Management System',
    'action', 3, 1, 0, 'reserves_coordinator', 15,
    'Generate LMS-ready links. Test in LMS environment. Provide faculty with integration instructions.'
);

-- Online Step 4: Faculty Testing
INSERT INTO workflow_steps (
    template_id, step_key, step_name, step_description, step_type,
    sequence_order, is_required, is_automated, assigned_role,
    estimated_duration_minutes, instructions
) VALUES (
    @online_template_id, 'faculty_testing', 'Faculty Testing Period',
    'Allow faculty to test access before course starts',
    'approval', 4, 1, 0, 'reserves_coordinator', 30,
    'Send test links to faculty. Wait for confirmation that everything works. Address any issues before finalizing.'
);

-- Online Step 5: Final Lock
INSERT INTO workflow_steps (
    template_id, step_key, step_name, step_description, step_type,
    sequence_order, is_required, is_automated, assigned_role,
    estimated_duration_minutes, instructions
) VALUES (
    @online_template_id, 'final_lock', 'Lock Course',
    'Finalize and lock online course',
    'approval', 5, 1, 0, 'reserves_manager', 2,
    'All testing complete. Lock submission and mark as ready for students.'
);

-- Online transitions (linear flow)
INSERT INTO workflow_step_transitions (from_step_id, to_step_id, transition_label, is_default)
SELECT s1.id, s2.id, 'Next step', 1
FROM workflow_steps s1
INNER JOIN workflow_steps s2 ON s1.template_id = s2.template_id 
    AND s2.sequence_order = s1.sequence_order + 1
WHERE s1.template_id = @online_template_id;

-- End online workflow
INSERT INTO workflow_step_transitions (from_step_id, to_step_id, transition_label, is_default)
SELECT id, NULL, 'Complete and lock', 1
FROM workflow_steps
WHERE template_id = @online_template_id
ORDER BY sequence_order DESC
LIMIT 1;


-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    'Workflow Templates Created' as summary,
    COUNT(*) as count
FROM workflow_templates
WHERE created_by = 'system';

SELECT 
    wt.name as template_name,
    COUNT(ws.id) as step_count,
    COUNT(DISTINCT wc.id) as condition_count,
    COUNT(DISTINCT wst.id) as transition_count
FROM workflow_templates wt
LEFT JOIN workflow_steps ws ON wt.id = ws.template_id
LEFT JOIN workflow_conditions wc ON ws.id = wc.step_id
LEFT JOIN workflow_step_transitions wst ON ws.id = wst.from_step_id
WHERE wt.created_by = 'system'
GROUP BY wt.id, wt.name;

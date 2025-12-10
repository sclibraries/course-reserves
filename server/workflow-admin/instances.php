<?php
/**
 * Workflow Instances Management API
 * Handles workflow execution and instance management
 */

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$auth = verifyAuth();
if (!$auth['success']) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

try {
    switch ($method) {
        case 'GET':
            handleGet($db, $auth['user_id']);
            break;
        case 'POST':
            handlePost($db, $auth['user_id']);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log("Workflow Instances API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

/**
 * GET - List instances or get single instance
 */
function handleGet($db, $userId) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $instanceId = null;
    
    // Check if requesting specific instance
    if (count($pathParts) >= 3 && $pathParts[count($pathParts) - 2] === 'instance') {
        $instanceId = intval($pathParts[count($pathParts) - 1]);
    }
    
    if ($instanceId) {
        getInstance($db, $instanceId);
    } else {
        listInstances($db, $userId);
    }
}

/**
 * List workflow instances with filters
 */
function listInstances($db, $userId) {
    $templateId = $_GET['template_id'] ?? null;
    $entityType = $_GET['entity_type'] ?? null;
    $entityId = $_GET['entity_id'] ?? null;
    $submissionId = $_GET['submission_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $assignedTo = $_GET['assigned_to'] ?? null;
    
    $sql = "SELECT 
                wi.id,
                wi.template_id,
                wi.template_version,
                wt.name as template_name,
                wi.entity_type,
                wi.entity_id,
                wi.submission_id,
                wi.current_step_id,
                ws.step_name as current_step_name,
                wi.status,
                wi.progress_percentage,
                wi.assigned_to_user_id,
                wi.assigned_to_role,
                wi.started_at,
                wi.completed_at,
                wi.due_date,
                wi.priority,
                wi.workflow_data,
                wi.metadata,
                wi.created_at,
                wi.updated_at
            FROM workflow_instances wi
            INNER JOIN workflow_templates wt ON wi.template_id = wt.id
            LEFT JOIN workflow_steps ws ON wi.current_step_id = ws.id
            WHERE 1=1";
    
    $params = [];
    $types = '';
    
    if ($templateId) {
        $sql .= " AND wi.template_id = ?";
        $params[] = intval($templateId);
        $types .= 'i';
    }
    
    if ($entityType) {
        $sql .= " AND wi.entity_type = ?";
        $params[] = $entityType;
        $types .= 's';
    }
    
    if ($entityId) {
        $sql .= " AND wi.entity_id = ?";
        $params[] = intval($entityId);
        $types .= 'i';
    }
    
    if ($submissionId) {
        $sql .= " AND wi.submission_id = ?";
        $params[] = intval($submissionId);
        $types .= 'i';
    }
    
    if ($status) {
        $sql .= " AND wi.status = ?";
        $params[] = $status;
        $types .= 's';
    }
    
    if ($assignedTo) {
        $sql .= " AND wi.assigned_to_user_id = ?";
        $params[] = $assignedTo;
        $types .= 's';
    }
    
    $sql .= " ORDER BY wi.created_at DESC";
    
    $stmt = $db->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $instances = [];
    while ($row = $result->fetch_assoc()) {
        if ($row['workflow_data']) {
            $row['workflow_data'] = json_decode($row['workflow_data'], true);
        }
        if ($row['metadata']) {
            $row['metadata'] = json_decode($row['metadata'], true);
        }
        $instances[] = $row;
    }
    
    echo json_encode(['instances' => $instances]);
}

/**
 * Get single instance with full history
 */
function getInstance($db, $instanceId) {
    // Get instance
    $stmt = $db->prepare("
        SELECT 
            wi.id,
            wi.template_id,
            wi.template_version,
            wt.name as template_name,
            wi.entity_type,
            wi.entity_id,
            wi.submission_id,
            wi.current_step_id,
            ws.step_name as current_step_name,
            wi.status,
            wi.progress_percentage,
            wi.assigned_to_user_id,
            wi.assigned_to_role,
            wi.started_at,
            wi.completed_at,
            wi.due_date,
            wi.priority,
            wi.workflow_data,
            wi.metadata,
            wi.created_at,
            wi.updated_at
        FROM workflow_instances wi
        INNER JOIN workflow_templates wt ON wi.template_id = wt.id
        LEFT JOIN workflow_steps ws ON wi.current_step_id = ws.id
        WHERE wi.id = ?
    ");
    $stmt->bind_param('i', $instanceId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Instance not found']);
        return;
    }
    
    $instance = $result->fetch_assoc();
    
    if ($instance['workflow_data']) {
        $instance['workflow_data'] = json_decode($instance['workflow_data'], true);
    }
    if ($instance['metadata']) {
        $instance['metadata'] = json_decode($instance['metadata'], true);
    }
    
    // Get history
    $stmt = $db->prepare("
        SELECT 
            id,
            step_id,
            step_key,
            status,
            result_data,
            condition_results,
            notes,
            completed_by_user_id,
            completed_by_name,
            started_at,
            completed_at,
            duration_minutes
        FROM workflow_step_history
        WHERE instance_id = ?
        ORDER BY started_at ASC
    ");
    $stmt->bind_param('i', $instanceId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $history = [];
    while ($row = $result->fetch_assoc()) {
        if ($row['result_data']) {
            $row['result_data'] = json_decode($row['result_data'], true);
        }
        if ($row['condition_results']) {
            $row['condition_results'] = json_decode($row['condition_results'], true);
        }
        $history[] = $row;
    }
    $instance['history'] = $history;
    
    echo json_encode($instance);
}

/**
 * POST - Handle various instance actions
 */
function handlePost($db, $userId) {
    $uri = $_SERVER['REQUEST_URI'];
    
    // Determine action from URL
    if (strpos($uri, '/start') !== false) {
        handleStart($db, $userId);
    } elseif (strpos($uri, '/complete-step') !== false) {
        handleCompleteStep($db, $userId);
    } elseif (strpos($uri, '/skip-step') !== false) {
        handleSkipStep($db, $userId);
    } elseif (strpos($uri, '/cancel') !== false) {
        handleCancel($db, $userId);
    } elseif (strpos($uri, '/hold') !== false) {
        handleHold($db, $userId);
    } elseif (strpos($uri, '/resume') !== false) {
        handleResume($db, $userId);
    } else {
        // Create new instance
        handleCreate($db, $userId);
    }
}

/**
 * Create new workflow instance
 */
function handleCreate($db, $userId) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['template_id']) || !isset($data['entity_type']) || !isset($data['entity_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: template_id, entity_type, entity_id']);
        return;
    }
    
    // Get template version
    $stmt = $db->prepare("SELECT version FROM workflow_templates WHERE id = ?");
    $stmt->bind_param('i', $data['template_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Template not found']);
        return;
    }
    
    $templateVersion = $result->fetch_assoc()['version'];
    
    // Create instance
    $stmt = $db->prepare("
        INSERT INTO workflow_instances 
        (template_id, template_version, entity_type, entity_id, submission_id, 
         priority, due_date, workflow_data, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $workflowData = isset($data['workflow_data']) ? json_encode($data['workflow_data']) : null;
    $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
    
    $stmt->bind_param('iisiissss',
        $data['template_id'],
        $templateVersion,
        $data['entity_type'],
        $data['entity_id'],
        $data['submission_id'] ?? null,
        $data['priority'] ?? 'normal',
        $data['due_date'] ?? null,
        $workflowData,
        $metadata
    );
    
    $stmt->execute();
    $instanceId = $db->insert_id;
    
    // Return created instance
    getInstance($db, $instanceId);
}

/**
 * Start workflow - move to first step
 */
function handleStart($db, $userId) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $instanceId = intval($pathParts[count($pathParts) - 2]);
    
    if (!$instanceId) {
        http_response_code(400);
        echo json_encode(['error' => 'Instance ID required']);
        return;
    }
    
    $db->begin_transaction();
    
    try {
        // Get first step
        $stmt = $db->prepare("
            SELECT ws.id 
            FROM workflow_steps ws
            INNER JOIN workflow_instances wi ON ws.template_id = wi.template_id
            WHERE wi.id = ?
            ORDER BY ws.sequence_order ASC
            LIMIT 1
        ");
        $stmt->bind_param('i', $instanceId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            throw new Exception('No steps found for workflow');
        }
        
        $firstStepId = $result->fetch_assoc()['id'];
        
        // Update instance
        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare("
            UPDATE workflow_instances 
            SET 
                status = 'in_progress',
                current_step_id = ?,
                assigned_to_user_id = ?,
                started_at = ?
            WHERE id = ?
        ");
        $stmt->bind_param('issi', $firstStepId, $userId, $now, $instanceId);
        $stmt->execute();
        
        // Create history entry
        $stmt = $db->prepare("
            INSERT INTO workflow_step_history 
            (instance_id, step_id, step_key, status, started_at, completed_by_user_id)
            SELECT ?, id, step_key, 'started', ?, ?
            FROM workflow_steps
            WHERE id = ?
        ");
        $stmt->bind_param('issi', $instanceId, $now, $userId, $firstStepId);
        $stmt->execute();
        
        $db->commit();
        
        // Return updated instance
        getInstance($db, $instanceId);
        
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
}

/**
 * Complete current step and advance
 */
function handleCompleteStep($db, $userId) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $instanceId = intval($pathParts[count($pathParts) - 2]);
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $db->begin_transaction();
    
    try {
        // Get current instance
        $stmt = $db->prepare("SELECT current_step_id, workflow_data FROM workflow_instances WHERE id = ?");
        $stmt->bind_param('i', $instanceId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            throw new Exception('Instance not found');
        }
        
        $instance = $result->fetch_assoc();
        $currentStepId = $instance['current_step_id'];
        
        if (!$currentStepId) {
            throw new Exception('No current step');
        }
        
        // Complete current step in history
        $now = date('Y-m-d H:i:s');
        $resultData = isset($data['step_data']) ? json_encode($data['step_data']) : null;
        $conditionResults = isset($data['condition_results']) ? json_encode($data['condition_results']) : null;
        
        $stmt = $db->prepare("
            UPDATE workflow_step_history 
            SET 
                status = 'completed',
                result_data = ?,
                condition_results = ?,
                notes = ?,
                completed_at = ?,
                completed_by_user_id = ?,
                duration_minutes = TIMESTAMPDIFF(MINUTE, started_at, ?)
            WHERE instance_id = ? AND step_id = ? AND status = 'started'
        ");
        $stmt->bind_param('ssssssii',
            $resultData,
            $conditionResults,
            $data['notes'] ?? null,
            $now,
            $userId,
            $now,
            $instanceId,
            $currentStepId
        );
        $stmt->execute();
        
        // Merge step data into workflow_data
        $workflowData = json_decode($instance['workflow_data'], true) ?? [];
        if (isset($data['step_data'])) {
            $workflowData = array_merge($workflowData, $data['step_data']);
        }
        
        // Determine next step using transitions
        $nextStepId = determineNextStep($db, $currentStepId, $data['condition_results'] ?? []);
        
        // Calculate progress
        $progress = calculateProgress($db, $instanceId);
        
        if ($nextStepId) {
            // Move to next step
            $stmt = $db->prepare("
                UPDATE workflow_instances 
                SET 
                    current_step_id = ?,
                    progress_percentage = ?,
                    workflow_data = ?
                WHERE id = ?
            ");
            $workflowDataJson = json_encode($workflowData);
            $stmt->bind_param('idsi', $nextStepId, $progress, $workflowDataJson, $instanceId);
            $stmt->execute();
            
            // Create history for next step
            $stmt = $db->prepare("
                INSERT INTO workflow_step_history 
                (instance_id, step_id, step_key, status, started_at, completed_by_user_id)
                SELECT ?, id, step_key, 'started', ?, ?
                FROM workflow_steps
                WHERE id = ?
            ");
            $stmt->bind_param('issi', $instanceId, $now, $userId, $nextStepId);
            $stmt->execute();
        } else {
            // No next step - complete workflow
            $stmt = $db->prepare("
                UPDATE workflow_instances 
                SET 
                    status = 'completed',
                    current_step_id = NULL,
                    progress_percentage = 100,
                    completed_at = ?,
                    workflow_data = ?
                WHERE id = ?
            ");
            $workflowDataJson = json_encode($workflowData);
            $stmt->bind_param('ssi', $now, $workflowDataJson, $instanceId);
            $stmt->execute();
            
            // Execute final actions (e.g., lock course)
            executeFinalActions($db, $instanceId);
        }
        
        $db->commit();
        
        // Return updated instance
        getInstance($db, $instanceId);
        
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
}

/**
 * Determine next step based on transitions and conditions
 */
function determineNextStep($db, $currentStepId, $conditionResults) {
    // Get transitions for current step, ordered by priority
    $stmt = $db->prepare("
        SELECT to_step_id, condition_id, condition_value, is_default
        FROM workflow_step_transitions
        WHERE from_step_id = ?
        ORDER BY priority DESC, is_default DESC
    ");
    $stmt->bind_param('i', $currentStepId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $defaultTransition = null;
    
    while ($row = $result->fetch_assoc()) {
        if ($row['is_default']) {
            $defaultTransition = $row['to_step_id'];
        }
        
        // Check if condition is met
        if ($row['condition_id'] && isset($conditionResults)) {
            // Get condition key
            $condStmt = $db->prepare("SELECT condition_key FROM workflow_conditions WHERE id = ?");
            $condStmt->bind_param('i', $row['condition_id']);
            $condStmt->execute();
            $condKey = $condStmt->get_result()->fetch_assoc()['condition_key'];
            
            // Check if condition value matches
            if (isset($conditionResults[$condKey]) && $conditionResults[$condKey] == $row['condition_value']) {
                return $row['to_step_id'];
            }
        }
    }
    
    return $defaultTransition;
}

/**
 * Calculate workflow progress percentage
 */
function calculateProgress($db, $instanceId) {
    $stmt = $db->prepare("
        SELECT 
            (SELECT COUNT(*) FROM workflow_step_history WHERE instance_id = ? AND status = 'completed') as completed,
            (SELECT COUNT(*) FROM workflow_steps WHERE template_id = (SELECT template_id FROM workflow_instances WHERE id = ?)) as total
    ");
    $stmt->bind_param('ii', $instanceId, $instanceId);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    if ($result['total'] == 0) return 0;
    
    return round(($result['completed'] / $result['total']) * 100, 2);
}

/**
 * Execute final actions when workflow completes
 */
function executeFinalActions($db, $instanceId) {
    // Get instance details and template actions
    $stmt = $db->prepare("
        SELECT wi.entity_type, wi.entity_id, wi.submission_id, wt.metadata
        FROM workflow_instances wi
        INNER JOIN workflow_templates wt ON wi.template_id = wt.id
        WHERE wi.id = ?
    ");
    $stmt->bind_param('i', $instanceId);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    if (!$result) return;
    
    $metadata = json_decode($result['metadata'], true);
    $finalActions = $metadata['final_actions'] ?? [];
    
    // Execute actions
    foreach ($finalActions as $action) {
        switch ($action['type']) {
            case 'lock_submission':
                if ($result['submission_id']) {
                    lockSubmission($db, $result['submission_id'], 'Workflow completed');
                }
                break;
            
            case 'send_notification':
                // Implementation for notifications
                break;
            
            case 'update_status':
                // Implementation for status updates
                break;
        }
    }
}

/**
 * Lock a submission
 */
function lockSubmission($db, $submissionId, $reason) {
    $stmt = $db->prepare("
        UPDATE faculty_submissions 
        SET 
            is_locked = 1,
            locked_at = NOW(),
            locked_reason = ?
        WHERE submission_id = ?
    ");
    $stmt->bind_param('si', $reason, $submissionId);
    $stmt->execute();
}

/**
 * Skip current step
 */
function handleSkipStep($db, $userId) {
    // Implementation similar to completeStep but marks as skipped
    // Left as exercise - follows same pattern
}

/**
 * Cancel workflow
 */
function handleCancel($db, $userId) {
    // Implementation to cancel workflow
    // Left as exercise - updates status to cancelled
}

/**
 * Put workflow on hold
 */
function handleHold($db, $userId) {
    // Implementation to hold workflow
    // Left as exercise - updates status to on_hold
}

/**
 * Resume workflow from hold
 */
function handleResume($db, $userId) {
    // Implementation to resume workflow
    // Left as exercise - updates status back to in_progress
}

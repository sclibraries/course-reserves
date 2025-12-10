<?php
/**
 * Workflow Steps Management API
 * Handles CRUD operations for workflow steps
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
if (!$auth['success'] || !hasPermission($auth['user_id'], 'workflow_admin')) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'POST':
            handlePost($db);
            break;
        case 'PUT':
            handlePut($db);
            break;
        case 'DELETE':
            handleDelete($db);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log("Workflow Steps API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

/**
 * POST - Create new step or reorder steps
 */
function handlePost($db) {
    $uri = $_SERVER['REQUEST_URI'];
    
    // Check if this is a reorder request
    if (strpos($uri, '/reorder') !== false) {
        handleReorder($db);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Extract template ID from URL
    preg_match('/\/template\/(\d+)\/steps/', $uri, $matches);
    $templateId = isset($matches[1]) ? intval($matches[1]) : null;
    
    if (!$templateId) {
        http_response_code(400);
        echo json_encode(['error' => 'Template ID required']);
        return;
    }
    
    if (!isset($data['step_key']) || !isset($data['step_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: step_key, step_name']);
        return;
    }
    
    // Get next sequence order
    $stmt = $db->prepare("SELECT COALESCE(MAX(sequence_order), 0) + 1 as next_order FROM workflow_steps WHERE template_id = ?");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    $nextOrder = $stmt->get_result()->fetch_assoc()['next_order'];
    
    // Create step
    $stmt = $db->prepare("
        INSERT INTO workflow_steps 
        (template_id, step_key, step_name, step_description, step_type, sequence_order, 
         is_required, is_automated, assigned_role, estimated_duration_minutes, instructions, form_fields, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $formFields = isset($data['form_fields']) ? json_encode($data['form_fields']) : null;
    $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
    $sequenceOrder = isset($data['sequence_order']) ? intval($data['sequence_order']) : $nextOrder;
    
    $stmt->bind_param('issssiiisisss',
        $templateId,
        $data['step_key'],
        $data['step_name'],
        $data['step_description'] ?? null,
        $data['step_type'] ?? 'action',
        $sequenceOrder,
        isset($data['is_required']) ? intval($data['is_required']) : 1,
        isset($data['is_automated']) ? intval($data['is_automated']) : 0,
        $data['assigned_role'] ?? null,
        $data['estimated_duration_minutes'] ?? null,
        $data['instructions'] ?? null,
        $formFields,
        $metadata
    );
    
    $stmt->execute();
    $stepId = $db->insert_id;
    
    // Return created step
    $stmt = $db->prepare("SELECT * FROM workflow_steps WHERE id = ?");
    $stmt->bind_param('i', $stepId);
    $stmt->execute();
    $step = $stmt->get_result()->fetch_assoc();
    
    if ($step['form_fields']) {
        $step['form_fields'] = json_decode($step['form_fields'], true);
    }
    if ($step['metadata']) {
        $step['metadata'] = json_decode($step['metadata'], true);
    }
    
    echo json_encode($step);
}

/**
 * PUT - Update step
 */
function handlePut($db) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $stepId = intval($pathParts[count($pathParts) - 1]);
    
    if (!$stepId) {
        http_response_code(400);
        echo json_encode(['error' => 'Step ID required']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $stmt = $db->prepare("
        UPDATE workflow_steps 
        SET 
            step_key = ?,
            step_name = ?,
            step_description = ?,
            step_type = ?,
            sequence_order = ?,
            is_required = ?,
            is_automated = ?,
            assigned_role = ?,
            estimated_duration_minutes = ?,
            instructions = ?,
            form_fields = ?,
            metadata = ?
        WHERE id = ?
    ");
    
    $formFields = isset($data['form_fields']) ? json_encode($data['form_fields']) : null;
    $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
    
    $stmt->bind_param('ssssiiisisssi',
        $data['step_key'],
        $data['step_name'],
        $data['step_description'] ?? null,
        $data['step_type'] ?? 'action',
        $data['sequence_order'] ?? 1,
        isset($data['is_required']) ? intval($data['is_required']) : 1,
        isset($data['is_automated']) ? intval($data['is_automated']) : 0,
        $data['assigned_role'] ?? null,
        $data['estimated_duration_minutes'] ?? null,
        $data['instructions'] ?? null,
        $formFields,
        $metadata,
        $stepId
    );
    
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Step not found']);
        return;
    }
    
    // Return updated step
    $stmt = $db->prepare("SELECT * FROM workflow_steps WHERE id = ?");
    $stmt->bind_param('i', $stepId);
    $stmt->execute();
    $step = $stmt->get_result()->fetch_assoc();
    
    if ($step['form_fields']) {
        $step['form_fields'] = json_decode($step['form_fields'], true);
    }
    if ($step['metadata']) {
        $step['metadata'] = json_decode($step['metadata'], true);
    }
    
    echo json_encode($step);
}

/**
 * DELETE - Delete step
 */
function handleDelete($db) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $stepId = intval($pathParts[count($pathParts) - 1]);
    
    if (!$stepId) {
        http_response_code(400);
        echo json_encode(['error' => 'Step ID required']);
        return;
    }
    
    // Check if step has history (being used in active workflows)
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM workflow_step_history WHERE step_id = ?");
    $stmt->bind_param('i', $stepId);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    if ($result['count'] > 0) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Cannot delete step',
            'message' => 'This step has been used in workflow instances. Consider deactivating the parent template instead.'
        ]);
        return;
    }
    
    $stmt = $db->prepare("DELETE FROM workflow_steps WHERE id = ?");
    $stmt->bind_param('i', $stepId);
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Step not found']);
        return;
    }
    
    echo json_encode(['success' => true, 'message' => 'Step deleted']);
}

/**
 * Reorder steps
 */
function handleReorder($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['steps']) || !is_array($data['steps'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Steps array required']);
        return;
    }
    
    $db->begin_transaction();
    
    try {
        $stmt = $db->prepare("UPDATE workflow_steps SET sequence_order = ? WHERE id = ?");
        
        foreach ($data['steps'] as $step) {
            if (!isset($step['id']) || !isset($step['sequence_order'])) {
                throw new Exception('Each step must have id and sequence_order');
            }
            
            $stmt->bind_param('ii', $step['sequence_order'], $step['id']);
            $stmt->execute();
        }
        
        $db->commit();
        echo json_encode(['success' => true, 'message' => 'Steps reordered']);
        
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
}

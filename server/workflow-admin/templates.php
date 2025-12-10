<?php
/**
 * Workflow Template Management API
 * Handles CRUD operations for workflow templates
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

// Verify authentication
$auth = verifyAuth();
if (!$auth['success']) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Check admin permissions
if (!hasPermission($auth['user_id'], 'workflow_admin')) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden: Workflow admin access required']);
    exit;
}

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

try {
    switch ($method) {
        case 'GET':
            handleGet($db);
            break;
        case 'POST':
            handlePost($db, $auth['user_id']);
            break;
        case 'PUT':
            handlePut($db, $auth['user_id']);
            break;
        case 'DELETE':
            handleDelete($db);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    error_log("Workflow Template API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $e->getMessage()]);
}

/**
 * GET - List templates or get single template
 */
function handleGet($db) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $templateId = null;
    
    // Check if requesting specific template: /workflow-admin/template/{id}
    if (count($pathParts) >= 3 && $pathParts[count($pathParts) - 2] === 'template') {
        $templateId = intval($pathParts[count($pathParts) - 1]);
    }
    
    if ($templateId) {
        getTemplateDetail($db, $templateId);
    } else {
        listTemplates($db);
    }
}

/**
 * List all templates with optional filters
 */
function listTemplates($db) {
    $type = $_GET['type'] ?? null;
    $active = $_GET['active'] ?? null;
    $category = $_GET['category'] ?? null;
    
    $sql = "SELECT 
                id,
                name as template_name,
                description,
                workflow_type as entity_type,
                is_active,
                version,
                category,
                trigger_conditions,
                metadata,
                created_by,
                updated_by,
                created_at,
                updated_at,
                (SELECT COUNT(*) FROM workflow_steps WHERE template_id = workflow_templates.id) as step_count
            FROM workflow_templates
            WHERE 1=1";
    
    $params = [];
    $types = '';
    
    if ($type) {
        $sql .= " AND workflow_type = ?";
        $params[] = $type;
        $types .= 's';
    }
    
    if ($active !== null) {
        $sql .= " AND is_active = ?";
        $params[] = intval($active);
        $types .= 'i';
    }
    
    if ($category) {
        $sql .= " AND category = ?";
        $params[] = $category;
        $types .= 's';
    }
    
    $sql .= " ORDER BY created_at DESC";
    
    $stmt = $db->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    
    $templates = [];
    while ($row = $result->fetch_assoc()) {
        // Decode JSON fields
        if ($row['trigger_conditions']) {
            $row['trigger_conditions'] = json_decode($row['trigger_conditions'], true);
        }
        if ($row['metadata']) {
            $row['metadata'] = json_decode($row['metadata'], true);
        }
        $templates[] = $row;
    }
    
    echo json_encode(['templates' => $templates]);
}

/**
 * Get full template details including steps, conditions, transitions
 */
function getTemplateDetail($db, $templateId) {
    // Get template
    $stmt = $db->prepare("
        SELECT 
            id,
            name as template_name,
            description,
            workflow_type as entity_type,
            is_active,
            version,
            category,
            trigger_conditions,
            metadata,
            created_by,
            updated_by,
            created_at,
            updated_at
        FROM workflow_templates
        WHERE id = ?
    ");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Template not found']);
        return;
    }
    
    $template = $result->fetch_assoc();
    
    // Decode JSON fields
    if ($template['trigger_conditions']) {
        $template['trigger_conditions'] = json_decode($template['trigger_conditions'], true);
    }
    if ($template['metadata']) {
        $template['metadata'] = json_decode($template['metadata'], true);
    }
    
    // Get steps
    $stmt = $db->prepare("
        SELECT 
            id,
            step_key,
            step_name,
            step_description,
            step_type,
            sequence_order as step_order,
            is_required,
            is_automated,
            assigned_role,
            estimated_duration_minutes,
            instructions,
            form_fields,
            metadata
        FROM workflow_steps
        WHERE template_id = ?
        ORDER BY sequence_order ASC
    ");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $steps = [];
    while ($row = $result->fetch_assoc()) {
        if ($row['form_fields']) {
            $row['form_fields'] = json_decode($row['form_fields'], true);
        }
        if ($row['metadata']) {
            $row['metadata'] = json_decode($row['metadata'], true);
        }
        $steps[] = $row;
    }
    $template['steps'] = $steps;
    
    // Get conditions
    $stmt = $db->prepare("
        SELECT 
            c.id,
            c.step_id,
            c.condition_key,
            c.condition_label,
            c.condition_type,
            c.field_name,
            c.operator,
            c.expected_value,
            c.choices,
            c.default_value,
            c.validation_rules,
            c.metadata
        FROM workflow_conditions c
        INNER JOIN workflow_steps s ON c.step_id = s.id
        WHERE s.template_id = ?
    ");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $conditions = [];
    while ($row = $result->fetch_assoc()) {
        if ($row['choices']) {
            $row['choices'] = json_decode($row['choices'], true);
        }
        if ($row['validation_rules']) {
            $row['validation_rules'] = json_decode($row['validation_rules'], true);
        }
        if ($row['metadata']) {
            $row['metadata'] = json_decode($row['metadata'], true);
        }
        $conditions[] = $row;
    }
    $template['conditions'] = $conditions;
    
    // Get transitions
    $stmt = $db->prepare("
        SELECT 
            t.id,
            t.from_step_id,
            t.to_step_id,
            t.condition_id,
            t.condition_value,
            t.transition_label,
            t.priority,
            t.actions,
            t.is_default,
            t.metadata
        FROM workflow_step_transitions t
        INNER JOIN workflow_steps s ON t.from_step_id = s.id
        WHERE s.template_id = ?
        ORDER BY t.from_step_id, t.priority DESC
    ");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $transitions = [];
    while ($row = $result->fetch_assoc()) {
        if ($row['actions']) {
            $row['actions'] = json_decode($row['actions'], true);
        }
        if ($row['metadata']) {
            $row['metadata'] = json_decode($row['metadata'], true);
        }
        $transitions[] = $row;
    }
    $template['transitions'] = $transitions;
    
    echo json_encode($template);
}

/**
 * POST - Create new template
 */
function handlePost($db, $userId) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data || !isset($data['name']) || !isset($data['workflow_type'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: name, workflow_type']);
        return;
    }
    
    $db->begin_transaction();
    
    try {
        // Create template
        $stmt = $db->prepare("
            INSERT INTO workflow_templates 
            (name, description, workflow_type, category, trigger_conditions, metadata, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $triggerConditions = isset($data['trigger_conditions']) ? json_encode($data['trigger_conditions']) : null;
        $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
        
        $stmt->bind_param('ssssssss',
            $data['name'],
            $data['description'] ?? null,
            $data['workflow_type'],
            $data['category'] ?? null,
            $triggerConditions,
            $metadata,
            $userId,
            $userId
        );
        
        $stmt->execute();
        $templateId = $db->insert_id;
        
        // Create steps if provided
        if (isset($data['steps']) && is_array($data['steps'])) {
            foreach ($data['steps'] as $step) {
                createStep($db, $templateId, $step);
            }
        }
        
        $db->commit();
        
        // Return created template
        getTemplateDetail($db, $templateId);
        
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
}

/**
 * PUT - Update template
 */
function handlePut($db, $userId) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $templateId = intval($pathParts[count($pathParts) - 1]);
    
    if (!$templateId) {
        http_response_code(400);
        echo json_encode(['error' => 'Template ID required']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    $db->begin_transaction();
    
    try {
        // Update template
        $stmt = $db->prepare("
            UPDATE workflow_templates 
            SET 
                name = ?,
                description = ?,
                workflow_type = ?,
                category = ?,
                is_active = ?,
                trigger_conditions = ?,
                metadata = ?,
                updated_by = ?,
                version = version + 1
            WHERE id = ?
        ");
        
        $triggerConditions = isset($data['trigger_conditions']) ? json_encode($data['trigger_conditions']) : null;
        $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
        $isActive = isset($data['is_active']) ? intval($data['is_active']) : 1;
        
        $stmt->bind_param('ssssisssi',
            $data['name'],
            $data['description'] ?? null,
            $data['workflow_type'],
            $data['category'] ?? null,
            $isActive,
            $triggerConditions,
            $metadata,
            $userId,
            $templateId
        );
        
        $stmt->execute();
        
        if ($stmt->affected_rows === 0) {
            // Check if template exists
            $checkStmt = $db->prepare("SELECT id FROM workflow_templates WHERE id = ?");
            $checkStmt->bind_param('i', $templateId);
            $checkStmt->execute();
            if ($checkStmt->get_result()->num_rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Template not found']);
                $db->rollback();
                return;
            }
        }
        
        $db->commit();
        
        // Return updated template
        getTemplateDetail($db, $templateId);
        
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
}

/**
 * DELETE - Delete template
 */
function handleDelete($db) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $templateId = intval($pathParts[count($pathParts) - 1]);
    
    if (!$templateId) {
        http_response_code(400);
        echo json_encode(['error' => 'Template ID required']);
        return;
    }
    
    // Check if template is in use
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM workflow_instances WHERE template_id = ?");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    
    if ($result['count'] > 0) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Cannot delete template',
            'message' => 'This template is currently in use by ' . $result['count'] . ' workflow instance(s). Deactivate the template instead.'
        ]);
        return;
    }
    
    // Delete template (cascades to steps, conditions, transitions)
    $stmt = $db->prepare("DELETE FROM workflow_templates WHERE id = ?");
    $stmt->bind_param('i', $templateId);
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Template not found']);
        return;
    }
    
    echo json_encode(['success' => true, 'message' => 'Template deleted']);
}

/**
 * Helper: Create a step
 */
function createStep($db, $templateId, $stepData) {
    $stmt = $db->prepare("
        INSERT INTO workflow_steps 
        (template_id, step_key, step_name, step_description, step_type, sequence_order, 
         is_required, is_automated, assigned_role, estimated_duration_minutes, instructions, form_fields, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $formFields = isset($stepData['form_fields']) ? json_encode($stepData['form_fields']) : null;
    $metadata = isset($stepData['metadata']) ? json_encode($stepData['metadata']) : null;
    
    $stmt->bind_param('issssiiisisss',
        $templateId,
        $stepData['step_key'],
        $stepData['step_name'],
        $stepData['step_description'] ?? null,
        $stepData['step_type'] ?? 'action',
        $stepData['sequence_order'] ?? 1,
        $stepData['is_required'] ?? 1,
        $stepData['is_automated'] ?? 0,
        $stepData['assigned_role'] ?? null,
        $stepData['estimated_duration_minutes'] ?? null,
        $stepData['instructions'] ?? null,
        $formFields,
        $metadata
    );
    
    $stmt->execute();
    return $db->insert_id;
}

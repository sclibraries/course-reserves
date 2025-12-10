/**
 * @file SubmissionDetail.jsx
 * @description Component for displaying detailed view of a single submission
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Alert, 
  Badge,
  Button,
  Card,
  CardBody,
  Spinner
} from 'reactstrap';
import { 
  FaLock, 
  FaUnlock, 
  FaArrowLeft, 
  FaFolder,
  FaBook,
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
  FaUser,
  FaHandPointRight,
  FaCog
} from 'react-icons/fa';
import useSubmissionWorkflowStore from '../../../store/submissionWorkflowStore';
import { submissionWorkflowService } from '../../../services/admin/submissionWorkflowService';
import { workflowService } from '../../../services/admin/workflowService';
import { toast } from 'react-toastify';
import '../../../css/SubmissionWorkflow.css';

/**
 * Statistics card component
 */
const StatCard = ({ label, value, color = 'primary', icon: Icon }) => (
  <div className="stat-card">
    <div className="stat-card-label">{label}</div>
    <div className={`stat-card-value text-${color}`}>
      {Icon && <Icon className="me-2" />}
      {value}
    </div>
  </div>
);

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string,
  icon: PropTypes.elementType
};

/**
 * Item card component for displaying individual resources (Browse Mode)
 */
const ItemCard = ({ 
  item, 
  displayNumber, 
  onClaim,
  onGoToWork,
  onReopen,
  currentUserId
}) => (
  <div className="item-card browse-mode">
    <div className="item-info">
      <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
        <div className="d-flex align-items-start gap-3 flex-grow-1">
          <div className="display-number">
            {displayNumber}
          </div>
          <div className="flex-grow-1">
            <div className="item-title">{item.title}</div>
          </div>
        </div>
        
        {/* Claim Status - READ ONLY */}
        <div>
          {!item.claimedBy ? (
            <Badge color="secondary">
              <FaClock className="me-1" />
              Unclaimed
            </Badge>
          ) : item.claimedBy.id === currentUserId ? (
            <Badge color="success">
              <FaUser className="me-1" />
              Claimed by You
            </Badge>
          ) : (
            <Badge color="info">
              <FaUser className="me-1" />
              {item.claimedBy.display_name || item.claimedBy.username}
            </Badge>
          )}
        </div>
      </div>
      
      {item.authors && <div className="item-authors">{item.authors}</div>}
      
      <div className="item-metadata">
        {item.barcode && (
          <span>
            <strong>Barcode:</strong> {item.barcode}
          </span>
        )}
        {item.callNumber && (
          <span>
            <strong>Call Number:</strong> {item.callNumber}
          </span>
        )}
        {item.url && (
          <span>
            <strong>URL:</strong>{' '}
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Link
            </a>
          </span>
        )}
        <span>
          <strong>Type:</strong> {item.materialType}
        </span>
        {item.isReuse && (
          <Badge color="info" pill>Reuse</Badge>
        )}
      </div>
      
      {item.staffNotes && (
        <div className="mt-2 p-2 bg-light rounded">
          <small>
            <strong>Staff Notes:</strong> {item.staffNotes}
          </small>
        </div>
      )}
      
      {item.facultyNotes && (
        <div className="mt-2">
          <small className="text-muted">
            <strong>Faculty Notes:</strong> {item.facultyNotes}
          </small>
        </div>
      )}
      
      {item.hasCommunications && (
        <div className="mt-2">
          <Badge color="primary" className="me-2">
            {item.communications.length} message{item.communications.length !== 1 ? 's' : ''}
          </Badge>
          {item.unreadCommunications > 0 && (
            <Badge color="warning">
              {item.unreadCommunications} unread
            </Badge>
          )}
          <div className="mt-2">
            {item.communications.map(comm => (
              <div key={comm.id} className="communication-preview mb-2 p-2 border-start border-3">
                <div className="d-flex justify-content-between">
                  <strong>{comm.sender_name}</strong>
                  <small className="text-muted">
                    {new Date(comm.created_at).toLocaleString()}
                  </small>
                </div>
                {comm.subject && (
                  <div className="text-muted small">{comm.subject}</div>
                )}
                <div>{comm.message}</div>
                {!comm.is_read && (
                  <Badge color="warning" size="sm">Unread</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    
    <div className="item-actions browse-mode">
      <StatusBadge status={item.status} />
      <PriorityBadge priority={item.priority} />
      
      {/* Simple action based on status and claim status */}
      <div className="mt-2">
        {item.status === 'complete' ? (
          // Item is complete - show reopen button
          <div className="d-flex flex-column gap-2">
            <Badge color="success" className="w-100 p-2">
              <FaCheckCircle className="me-1" />
              Complete
            </Badge>
            <Button 
              color="warning" 
              size="sm" 
              outline
              onClick={() => onReopen(item.id)}
              className="w-100"
            >
              <FaExclamationCircle className="me-1" />
              Reopen for Processing
            </Button>
          </div>
        ) : !item.claimedBy ? (
          // Unclaimed and not complete - show claim button
          <Button 
            color="primary" 
            size="sm" 
            onClick={() => onClaim(item.id)}
            className="w-100"
          >
            <FaHandPointRight className="me-1" />
            Claim This Item
          </Button>
        ) : item.claimedBy.id === currentUserId ? (
          // Claimed by current user - show work button
          <Button 
            color="success" 
            size="sm" 
            onClick={() => onGoToWork(item.id)}
            className="w-100"
          >
            <FaCog className="me-1" />
            Work on This
          </Button>
        ) : (
          // Claimed by someone else
          <Badge color="secondary" className="w-100 p-2">
            Being handled by {item.claimedBy.display_name || item.claimedBy.username}
          </Badge>
        )}
      </div>
    </div>
  </div>
);

ItemCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    authors: PropTypes.string,
    barcode: PropTypes.string,
    callNumber: PropTypes.string,
    url: PropTypes.string,
    materialType: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    priority: PropTypes.string.isRequired,
    facultyNotes: PropTypes.string,
    staffNotes: PropTypes.string,
    isReuse: PropTypes.bool,
    hasCommunications: PropTypes.bool,
    communications: PropTypes.array,
    unreadCommunications: PropTypes.number,
    displayOrder: PropTypes.number,
    positionInFolder: PropTypes.number,
    claimedBy: PropTypes.shape({
      id: PropTypes.number,
      username: PropTypes.string,
      display_name: PropTypes.string
    })
  }).isRequired,
  displayNumber: PropTypes.string.isRequired,
  onClaim: PropTypes.func.isRequired,
  onGoToWork: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  currentUserId: PropTypes.number.isRequired
};

/**
 * Status badge component
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: 'warning', text: 'Pending' },
    in_progress: { color: 'info', text: 'In Progress' },
    complete: { color: 'success', text: 'Complete' },
    unavailable: { color: 'danger', text: 'Unavailable' }
  };
  
  const config = statusConfig[status] || { color: 'secondary', text: status };
  
  return <Badge color={config.color}>{config.text}</Badge>;
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired
};

/**
 * Priority badge component
 */
const PriorityBadge = ({ priority }) => {
  const priorityConfig = {
    urgent: { color: 'danger', text: 'Urgent' },
    high: { color: 'warning', text: 'High' },
    medium: { color: 'info', text: 'Medium' },
    low: { color: 'secondary', text: 'Low' }
  };
  
  const config = priorityConfig[priority] || priorityConfig.medium;
  
  return (
    <Badge color={config.color} pill>
      {config.text}
    </Badge>
  );
};

PriorityBadge.propTypes = {
  priority: PropTypes.string.isRequired
};

/**
 * Main submission detail component
 */
function SubmissionDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  
  const {
    selectedSubmission,
    loading,
    error,
    fetchSubmissionDetail,
    lockSubmission,
    unlockSubmission,
    clearError,
    claimItem,
    updateItemStatus
  } = useSubmissionWorkflowStore();

  const [currentUser, setCurrentUser] = useState(null);
  const [courseWorkflow, setCourseWorkflow] = useState(null);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [stepDataInputs, setStepDataInputs] = useState({});
  const [showDataEntryForStep, setShowDataEntryForStep] = useState({});
  const [folioInputs, setFolioInputs] = useState({}); // { stepId: { courseId: '', isVerifying: false } }

  // Load submission detail on mount
  useEffect(() => {
    if (submissionId) {
      fetchSubmissionDetail(submissionId);
      loadWorkflowStatus(submissionId);
      loadAvailableTemplates();
    }
  }, [submissionId, fetchSubmissionDetail]);
  
  // Load current user from backend (based on auth token)
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await submissionWorkflowService.getCurrentUser();
        console.log('Current user from backend:', user);
        console.log('User ID:', user.id, 'Type:', typeof user.id);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load current user:', error);
        // Fallback to localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          console.log('Current user from localStorage (fallback):', user);
          setCurrentUser(user);
        }
      }
    };
    
    loadCurrentUser();
  }, []);

  // Load workflow status for this submission
  const loadWorkflowStatus = async (subId) => {
    setWorkflowsLoading(true);
    try {
      const instances = await workflowService.listInstances({
        entity_type: 'course',
        submission_id: subId
      });
      
      console.log('Workflow instances found:', instances);
      
      if (instances && instances.length > 0) {
        const instance = await workflowService.getInstance(instances[0].id);
        console.log('Workflow instance details:', instance);
        setCourseWorkflow(instance);
      }
    } catch (error) {
      console.error('Failed to load workflow status:', error);
    } finally {
      setWorkflowsLoading(false);
    }
  };

  // Load available workflow templates
  const loadAvailableTemplates = async () => {
    try {
      const templates = await workflowService.listTemplates({
        type: 'course',
        active: true
      });
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Failed to load workflow templates:', error);
    }
  };

  // Apply a workflow template to this submission
  const handleApplyWorkflow = async (templateId) => {
    if (!submissionId) return;
    
    try {
      // Create workflow instance
      const response = await workflowService.createInstance({
        template_id: templateId,
        entity_type: 'course',
        entity_id: submissionId,
        submission_id: submissionId,
        priority: 'normal',
        workflow_data: {
          course_code: selectedSubmission?.submission?.courseCode,
          faculty_name: selectedSubmission?.submission?.facultyName,
          term: selectedSubmission?.submission?.term
        }
      });

      console.log('Create instance response:', response);

      // Extract instance from response - handle both direct and nested structures
      const instance = response.instance || response;
      
      console.log('Extracted instance:', instance);
      console.log('Instance ID:', instance.id, 'Type:', typeof instance.id);
      
      if (!instance || !instance.id) {
        throw new Error('Invalid response from server - missing instance ID');
      }

      // Start the workflow
      console.log('About to call startWorkflow with ID:', instance.id);
      const startResponse = await workflowService.startWorkflow(instance.id);
      console.log('Start workflow response:', startResponse);
      
      toast.success('Workflow applied and started successfully');
      
      // Reload workflow status
      await loadWorkflowStatus(submissionId);
    } catch (error) {
      console.error('Failed to apply workflow:', error);
      toast.error(error.message || 'Failed to apply workflow');
    }
  };

  // Complete current step and advance workflow
  // eslint-disable-next-line no-unused-vars
  const handleCompleteStep = async () => {
    if (!courseWorkflow || !courseWorkflow.id) return;
    
    try {
      await workflowService.completeStep(
        courseWorkflow.id, 
        {}, // stepData - empty for now
        {}, // conditionResults - empty for now
        'Step completed from submission detail'
      );
      
      toast.success('Step completed successfully');
      
      // Reload workflow status
      await loadWorkflowStatus(submissionId);
    } catch (error) {
      console.error('Failed to complete step:', error);
      toast.error(error.message || 'Failed to complete step');
    }
  };

  // Skip current step
  const handleSkipStep = async () => {
    if (!courseWorkflow || !courseWorkflow.id) return;
    
    if (!confirm('Are you sure you want to skip this step?')) {
      return;
    }
    
    try {
      await workflowService.skipStep(courseWorkflow.id, 'Skipped from submission detail');
      
      toast.success('Step skipped');
      
      // Reload workflow status
      await loadWorkflowStatus(submissionId);
    } catch (error) {
      console.error('Failed to skip step:', error);
      toast.error(error.message || 'Failed to skip step');
    }
  };

  // Go back to previous step
  const handleGoBack = async () => {
    if (!courseWorkflow || !courseWorkflow.id) return;
    
    const reason = prompt('Reason for going back to the previous step (optional):');
    if (reason === null) {
      // User cancelled
      return;
    }
    
    try {
      console.log('Going back with reason:', reason);
      const result = await workflowService.goBack(courseWorkflow.id, reason);
      console.log('Go back result:', result);
      
      toast.success(result.message || 'Moved back to previous step');
      
      // Reload workflow status
      await loadWorkflowStatus(submissionId);
    } catch (error) {
      console.error('Failed to go back:', error);
      toast.error(error.message || 'Failed to go back to previous step');
    }
  };

  // Manually start a workflow that's in not_started state
  const handleManualStart = async () => {
    if (!courseWorkflow || !courseWorkflow.id) return;
    
    try {
      console.log('Manually starting workflow instance:', courseWorkflow.id);
      await workflowService.startWorkflow(courseWorkflow.id);
      
      toast.success('Workflow started successfully');
      
      // Reload workflow status
      await loadWorkflowStatus(submissionId);
    } catch (error) {
      console.error('Failed to start workflow:', error);
      toast.error(error.message || 'Failed to start workflow');
    }
  };

  const handleCompleteStepWithData = async (step, stepData = {}) => {
    if (!courseWorkflow || !courseWorkflow.id) return;

    const stepName = step.step_name || step.name || 'this step';
    // Use instance_step_id first, then fall back to step_id or id
    const stepId = step.instance_step_id ?? step.step_id ?? step.id;

    if (!stepId) {
      console.error('No valid step ID found:', step);
      toast.error('Cannot complete step: missing step identifier');
      return;
    }

    try {
      // Use the new transition endpoint with action: 'complete'
      await workflowService.transitionStep(courseWorkflow.id, stepId, {
        action: 'complete',
        notes: `Step "${stepName}" completed from SubmissionDetail UI`,
        step_data: stepData
      });

      toast.success(`Step "${stepName}" marked complete.`);
      await loadWorkflowStatus(submissionId);
    } catch (error) {
      console.error('Failed to complete step:', error);
      if (error.code === 'AUTOMATED_STEP_USE_AUTOMATION_ENDPOINT') {
        toast.error('This step is automated and must be completed using its automation button in the Workflow panel.');
      } else if (error.code === 'WORKFLOW_GATED') {
        toast.error(error.message || 'Workflow is gated. Complete prerequisite steps first.');
      } else if (error.code === 'STEP_ALREADY_COMPLETED') {
        toast.info('This step is already completed.');
      } else {
        toast.error(error.message || 'Failed to complete step');
      }
    }
  };

  const renderWorkflowChecklist = () => {
    if (!courseWorkflow || !Array.isArray(courseWorkflow.steps) || courseWorkflow.steps.length === 0) {
      return (
        <Alert color="secondary" className="mt-3 mb-0">
          <FaExclamationCircle className="me-2" />
          No checklist steps are defined for this workflow.
        </Alert>
      );
    }

    const steps = [...courseWorkflow.steps].sort((a, b) => {
      const orderA = a.step_order ?? a.sequence_order ?? 0;
      const orderB = b.step_order ?? b.sequence_order ?? 0;
      return orderA - orderB;
    });

    const statusBadgeConfig = {
      completed: { color: 'success', text: 'Completed' },
      failed: { color: 'danger', text: 'Failed' },
      skipped: { color: 'secondary', text: 'Skipped' },
      in_progress: { color: 'info', text: 'In Progress' },
      not_started: { color: 'secondary', text: 'Not Started' }
    };

    return (
      <div className="mt-3">
        <h6 className="mb-2">Workflow Checklist</h6>
        <div className="list-group">
          {steps.map((step) => {
            const statusKey = (step.status || 'not_started').toLowerCase();
            
            // Normalize 'complete' to 'completed' for consistency
            const normalizedStatusKey = statusKey === 'complete' ? 'completed' : statusKey;
            
            const statusBadge = statusBadgeConfig[normalizedStatusKey] || {
              color: 'secondary',
              text: (step.status || 'unknown').replace(/_/g, ' ')
            };
            
            const isGate =
              step.is_gate === true ||
              step.is_gate === 1 ||
              step.is_gate === '1' ||
              step.is_gate === 'true';
            
            const dependsOn = Array.isArray(step.depends_on) ? step.depends_on : [];
            const unmetDependencies = dependsOn.some((depId) => {
              const dependency = courseWorkflow.steps.find((s) => Number(s.id) === Number(depId));
              if (!dependency) return true;
              
              const depStatus = (dependency.status || '').toLowerCase();
              return !['completed', 'complete'].includes(depStatus);
            });
            
            const isCompleted = normalizedStatusKey === 'completed';
            const isFailed = normalizedStatusKey === 'failed';
            const isSkipped = normalizedStatusKey === 'skipped';
            
            const canAct =
              courseWorkflow.status === 'in_progress' &&
              !isCompleted &&
              !isSkipped &&
              !isFailed &&
              !unmetDependencies;
            
            const stepName = step.step_name || step.name || step.step_key || `Step ${step.step_id || step.id}`;
            const stepOrder = step.step_order ?? step.sequence_order;
            
            // Check if this is the special FOLIO course check step
            const isFolioCourseCheckStep =
              isGate &&
              step.is_automated &&
              step.automation_handler === 'check_course_exists';
            
            // Parse required_data if it exists
            let requiredData = null;
            if (step.required_data) {
              try {
                requiredData = typeof step.required_data === 'string' 
                  ? JSON.parse(step.required_data) 
                  : step.required_data;
              } catch (e) {
                console.warn('Failed to parse required_data for step:', step.step_id || step.id, e);
              }
            }
            
            // Use instance_step_id as the primary key for UI state, fallback to step_id or id
            const stepId = step.instance_step_id ?? step.step_id ?? step.id;
            const showDataEntry = showDataEntryForStep[stepId] || false;
            const dataInputValue = stepDataInputs[stepId] || '';
            
            // For FOLIO check step, get state from folioInputs
            const folioState = folioInputs[stepId] || { courseId: '', isVerifying: false };
            
            const handleFolioVerify = async () => {
              if (!folioState.courseId.trim()) {
                toast.error('Please enter the FOLIO course ID.');
                return;
              }
              
              // Set verifying state
              setFolioInputs(prev => ({
                ...prev,
                [stepId]: { ...folioState, isVerifying: true }
              }));
              
              try {
                // Call the FOLIO link endpoint
                await submissionWorkflowService.linkFolioCourse(
                  courseWorkflow.id,
                  stepId,
                  {
                    course_id: folioState.courseId.trim()
                  }
                );
                
                toast.success('FOLIO course verified and linked. Step completed.');
                
                // Reload workflow status to show updated state
                await loadWorkflowStatus(submissionId);
                
                // Clear the inputs
                setFolioInputs(prev => ({
                  ...prev,
                  [stepId]: { courseId: '', isVerifying: false }
                }));
              } catch (error) {
                console.error('Failed to verify FOLIO course:', error);
                const message = error.message || 'Could not verify FOLIO course. Check the ID and try again.';
                toast.error(message);
                
                // Clear verifying state
                setFolioInputs(prev => ({
                  ...prev,
                  [stepId]: { ...folioState, isVerifying: false }
                }));
              }
            };
            
            const handleCheckboxChange = async () => {
              if (isCompleted || !canAct) return;
              
              // If step requires data and we haven't shown the input yet, show it
              if (requiredData && !showDataEntry) {
                setShowDataEntryForStep(prev => ({ ...prev, [stepId]: true }));
                return;
              }
              
              // If data is required and provided, or no data required
              if (requiredData) {
                if (!dataInputValue.trim()) {
                  toast.warning(`Please enter ${requiredData.label || 'required data'} before completing this step.`);
                  return;
                }
                
                const stepData = {
                  [requiredData.field]: dataInputValue.trim()
                };
                
                await handleCompleteStepWithData(step, stepData);
                setShowDataEntryForStep(prev => ({ ...prev, [stepId]: false }));
                setStepDataInputs(prev => ({ ...prev, [stepId]: '' }));
              } else {
                await handleCompleteStepWithData(step, {});
              }
            };

            return (
              <div
                key={stepId}
                className={`list-group-item d-flex align-items-start gap-3 ${isCompleted ? 'list-group-item-success' : ''} ${!canAct && !isCompleted ? 'list-group-item-secondary' : ''}`}
              >
                {/* SPECIAL UI FOR FOLIO COURSE CHECK STEP */}
                {isFolioCourseCheckStep && !isCompleted ? (
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                      {stepOrder !== undefined && stepOrder !== null && (
                        <Badge color="secondary" pill>
                          #{stepOrder}
                        </Badge>
                      )}
                      <strong>{stepName}</strong>
                      <Badge color={statusBadge.color} pill>
                        {statusBadge.text}
                      </Badge>
                      {isGate && (
                        <Badge color="danger" pill>
                          Gate
                        </Badge>
                      )}
                      {step.is_required && (
                        <Badge color="warning" pill>
                          Required
                        </Badge>
                      )}
                    </div>
                    
                    {step.description && (
                      <div className="text-muted small mb-2">
                        {step.description}
                      </div>
                    )}
                    
                    {step.instructions && (
                      <div className="text-muted small fst-italic mb-2">
                        <strong>Instructions:</strong> {step.instructions}
                      </div>
                    )}
                    
                    {/* FOLIO VERIFICATION INPUTS */}
                    {canAct && (
                      <div className="mt-2 p-3 bg-light rounded border">
                        <div className="text-muted small mb-2">
                          Enter the FOLIO Course ID (UUID) to verify this course exists in FOLIO.
                        </div>
                        <div className="row g-2 mb-2">
                          <div className="col-md-10">
                            <label className="form-label small mb-1">
                              <strong>FOLIO Course ID</strong>
                              <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="e.g., 2e441277-0553-4187-8efc-da47d052aff2"
                              value={folioState.courseId}
                              onChange={(e) => setFolioInputs(prev => ({
                                ...prev,
                                [stepId]: { ...folioState, courseId: e.target.value }
                              }))}
                              disabled={folioState.isVerifying}
                            />
                          </div>
                          <div className="col-md-2 d-flex align-items-end">
                            <Button
                              color="primary"
                              size="sm"
                              onClick={handleFolioVerify}
                              disabled={folioState.isVerifying || !folioState.courseId.trim()}
                              className="w-100"
                            >
                              {folioState.isVerifying ? (
                                <>
                                  <Spinner size="sm" className="me-1" />
                                  Verifying...
                                </>
                              ) : (
                                'Verify in FOLIO'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!canAct && (
                      <div className="small text-muted mt-2">
                        {courseWorkflow.status !== 'in_progress' && 'Workflow must be in progress to complete steps.'}
                        {unmetDependencies && 'Complete prerequisite steps first.'}
                      </div>
                    )}
                  </div>
                ) : (
                  /* STANDARD CHECKBOX UI FOR OTHER STEPS */
                  <>
                    <div className="form-check mt-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={isCompleted}
                        disabled={!canAct}
                        onChange={handleCheckboxChange}
                        style={{ cursor: canAct ? 'pointer' : 'not-allowed' }}
                      />
                    </div>
                    
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                        {stepOrder !== undefined && stepOrder !== null && (
                          <Badge color="secondary" pill>
                            #{stepOrder}
                          </Badge>
                        )}
                        <strong className={isCompleted ? 'text-decoration-line-through' : ''}>
                          {stepName}
                        </strong>
                        <Badge color={statusBadge.color} pill>
                          {statusBadge.text}
                        </Badge>
                        {isGate && (
                          <Badge color="danger" pill>
                            Gate
                          </Badge>
                        )}
                        {step.is_required && (
                          <Badge color="warning" pill>
                            Required
                          </Badge>
                        )}
                        {unmetDependencies && (
                          <Badge color="secondary" pill>
                            Waiting on prerequisites
                          </Badge>
                        )}
                      </div>
                      
                      {step.description && (
                        <div className="text-muted small mb-1">
                          {step.description}
                        </div>
                      )}
                      
                      {step.instructions && (
                        <div className="text-muted small fst-italic mb-2">
                          <strong>Instructions:</strong> {step.instructions}
                        </div>
                      )}
                      
                      {/* Data entry field if required */}
                      {requiredData && !isCompleted && canAct && showDataEntry && (
                        <div className="mt-2 p-2 bg-light rounded border">
                          <label className="form-label small mb-1">
                            <strong>{requiredData.label || requiredData.field}</strong>
                            {requiredData.required && <span className="text-danger">*</span>}
                          </label>
                          {requiredData.description && (
                            <div className="text-muted small mb-2">{requiredData.description}</div>
                          )}
                          <div className="input-group input-group-sm">
                            <input
                              type={requiredData.type || 'text'}
                              className="form-control"
                              placeholder={requiredData.placeholder || `Enter ${requiredData.label || requiredData.field}`}
                              value={dataInputValue}
                              onChange={(e) => setStepDataInputs(prev => ({ ...prev, [stepId]: e.target.value }))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleCheckboxChange();
                                }
                              }}
                            />
                            <Button
                              color="primary"
                              size="sm"
                              onClick={handleCheckboxChange}
                            >
                              Submit & Complete
                            </Button>
                            <Button
                              color="secondary"
                              size="sm"
                              outline
                              onClick={() => {
                                setShowDataEntryForStep(prev => ({ ...prev, [stepId]: false }));
                                setStepDataInputs(prev => ({ ...prev, [stepId]: '' }));
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!canAct && !isCompleted && (
                        <div className="small text-muted mt-1">
                          {courseWorkflow.status !== 'in_progress' && 'Workflow must be in progress to complete steps.'}
                          {unmetDependencies && 'Complete prerequisite steps first.'}
                          {(isFailed || isSkipped) && 'This step cannot be completed.'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleLockSubmission = async () => {
    if (selectedSubmission) {
      const result = await lockSubmission(
        selectedSubmission.submission.uuid,
        'Processing items'
      );
      if (result.success) {
        // Refresh the detail view
        await fetchSubmissionDetail(submissionId);
      }
    }
  };

  const handleUnlockSubmission = async () => {
    if (selectedSubmission) {
      const result = await unlockSubmission(selectedSubmission.submission.uuid);
      if (result.success) {
        // Refresh the detail view
        await fetchSubmissionDetail(submissionId);
      }
    }
  };
  
  const handleClaim = async (itemId) => {
    const result = await claimItem(itemId);
    if (result.success) {
      // Only show success toast and refresh if claim was actually successful
      toast.success(
        <div>
          Item claimed! 
          <button 
            onClick={() => navigate(`/admin?tab=my-work&item=${itemId}`)}
            style={{ marginLeft: '10px', textDecoration: 'underline', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            Go to My Work →
          </button>
        </div>,
        { autoClose: 5000 }
      );
      // Refresh the submission detail to show updated claim status
      await fetchSubmissionDetail(submissionId);
    } else {
      // Show the actual error message from the backend
      toast.error(result.error || 'Failed to claim item');
      // Still refresh to show current state
      await fetchSubmissionDetail(submissionId);
    }
  };
  
  const handleGoToWork = (itemId) => {
    // Navigate to My Work Queue tab with this item
    navigate(`/admin?tab=my-work&item=${itemId}`);
  };

  const handleReopen = async (itemId) => {
    if (confirm('Are you sure you want to reopen this item for processing? It will be moved back to "in progress" status.')) {
      const result = await updateItemStatus(itemId, 'in_progress');
      if (result.success) {
        toast.success('Item reopened for processing');
        // Refresh the submission detail to show updated status
        await fetchSubmissionDetail(submissionId);
      } else {
        toast.error(result.error || 'Failed to reopen item');
      }
    }
  };

  const handleBack = () => {
    navigate('/admin?tab=submissions');
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner color="primary" size="lg" />
        <p className="text-muted">Loading submission details...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="submission-detail">
        <Alert color="danger" toggle={clearError}>
          <h4 className="alert-heading">Error Loading Submission</h4>
          <p>{error}</p>
        </Alert>
        <Button color="secondary" onClick={handleBack}>
          <FaArrowLeft className="me-2" />
          Back to Queue
        </Button>
      </div>
    );
  }

  // No submission found
  if (!selectedSubmission) {
    return (
      <div className="submission-detail">
        <Alert color="warning">
          <h4 className="alert-heading">Submission Not Found</h4>
          <p>The requested submission could not be found.</p>
        </Alert>
        <Button color="secondary" onClick={handleBack}>
          <FaArrowLeft className="me-2" />
          Back to Queue
        </Button>
      </div>
    );
  }

  const { submission, folders, unfolderedItems, statistics } = selectedSubmission;

  // Calculate display numbers for all items
  let currentNumber = 1;
  const itemDisplayNumbers = {};
  
  // First, number all folders and their items
  folders.forEach((folder) => {
    const folderNumber = currentNumber;
    currentNumber++;
    
    folder.items.forEach((item, index) => {
      itemDisplayNumbers[item.id] = `${folderNumber}.${index + 1}`;
    });
  });
  
  // Then number unfoldered items
  unfolderedItems.forEach((item) => {
    itemDisplayNumbers[item.id] = `${currentNumber}`;
    currentNumber++;
  });

  return (
    <div className="submission-detail">
      {/* Back Button */}
      <Button color="link" onClick={handleBack} className="mb-3 ps-0">
        <FaArrowLeft className="me-2" />
        Back to Queue
      </Button>

      {/* Header */}
      <Card className="submission-header mb-4">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h1 className="h3 mb-2">
                {submission.courseCode}
                {submission.section && ` - ${submission.section}`}: {submission.courseTitle}
              </h1>
              <div className="submission-meta">
                <span>
                  <strong>Faculty:</strong> {submission.facultyName}
                </span>
                <span>
                  <strong>Term:</strong> {submission.term}
                </span>
                <span>
                  <strong>Submitted:</strong>{' '}
                  {new Date(submission.submittedAt).toLocaleDateString()}
                </span>
                <span>
                  <strong>Status:</strong> <StatusBadge status={submission.status} />
                </span>
              </div>
            </div>
          </div>

          {/* Lock Status */}
          {submission.isLocked && (
            <Alert color="warning" className="mb-3">
              <FaLock className="me-2" />
              This submission is currently locked
              {submission.lockedBy && ` by ${submission.lockedBy}`}
              {submission.lockedAt && 
                ` on ${new Date(submission.lockedAt).toLocaleString()}`}
              {submission.lockReason && (
                <div className="mt-1">
                  <small>Reason: {submission.lockReason}</small>
                </div>
              )}
            </Alert>
          )}

          {/* Actions */}
          <div className="submission-actions">
            {!submission.isLocked ? (
              <Button color="warning" onClick={handleLockSubmission}>
                <FaLock className="me-2" />
                Lock & Process
              </Button>
            ) : (
              <Button color="success" onClick={handleUnlockSubmission}>
                <FaUnlock className="me-2" />
                Unlock
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Workflow Status Section */}
      <Card className="workflow-status mb-4">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Course Workflow</h5>
            {workflowsLoading && <Spinner size="sm" />}
          </div>
          
          {courseWorkflow ? (
            // Existing workflow display
            <div className="workflow-info">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <strong>{courseWorkflow.template_name}</strong>
                  <div className="text-muted small">
                    Template ID: {courseWorkflow.template_id} | Instance ID: {courseWorkflow.id}
                  </div>
                </div>
                <Badge 
                  color={
                    courseWorkflow.status === 'completed' ? 'success' :
                    courseWorkflow.status === 'in_progress' ? 'info' :
                    courseWorkflow.status === 'on_hold' ? 'warning' :
                    'secondary'
                  }
                  className="text-uppercase"
                >
                  {courseWorkflow.status?.replace('_', ' ')}
                </Badge>
              </div>
              
              {/* Workflow Metadata */}
              <div className="mt-2">
                {courseWorkflow.started_at && (
                  <div className="text-muted small">
                    <strong>Started:</strong> {new Date(courseWorkflow.started_at).toLocaleString()}
                  </div>
                )}
                {courseWorkflow.due_date && (
                  <div className="text-muted small">
                    <strong>Due Date:</strong> {new Date(courseWorkflow.due_date).toLocaleDateString()}
                  </div>
                )}
                {courseWorkflow.priority && (
                  <div className="text-muted small">
                    <strong>Priority:</strong> <PriorityBadge priority={courseWorkflow.priority} />
                  </div>
                )}
              </div>
              
              {renderWorkflowChecklist()}

              {courseWorkflow.status === 'in_progress' && (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Button 
                    color="secondary" 
                    size="sm"
                    outline
                    onClick={handleGoBack}
                    title="Go back to previous step"
                  >
                    <FaArrowLeft className="me-1" />
                    Go Back
                  </Button>
                  <Button 
                    color="warning" 
                    size="sm"
                    outline
                    onClick={handleSkipStep}
                  >
                    Skip Step
                  </Button>
                </div>
              )}

              {courseWorkflow.status === 'not_started' ? (
                <Alert color="info" className="mt-3 mb-0">
                  <FaClock className="me-2" />
                  Workflow has been created but not yet started.
                  <div className="mt-2">
                    <Button 
                      color="primary" 
                      size="sm"
                      onClick={handleManualStart}
                    >
                      Start Workflow Now
                    </Button>
                  </div>
                </Alert>
              ) : courseWorkflow.status === 'completed' ? (
                <Alert color="success" className="mt-3 mb-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <FaCheckCircle className="me-2" />
                      Workflow completed successfully!
                      {courseWorkflow.completed_at && (
                        <div className="small mt-1">
                          Completed: {new Date(courseWorkflow.completed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <Button 
                      color="secondary" 
                      size="sm"
                      outline
                      onClick={handleGoBack}
                      title="Reopen workflow and go back to last step"
                    >
                      <FaArrowLeft className="me-1" />
                      Go Back
                    </Button>
                  </div>
                </Alert>
              ) : null}
              
              {/* Progress Bar */}
              {courseWorkflow.progress_percentage !== undefined && (
                <div className="mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <small>Progress</small>
                    <small>{courseWorkflow.progress_percentage}%</small>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div 
                      className="progress-bar bg-success" 
                      role="progressbar" 
                      style={{ width: `${courseWorkflow.progress_percentage}%` }}
                      aria-valuenow={courseWorkflow.progress_percentage} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    />
                  </div>
                  {courseWorkflow.progress_mode && (
                    <small className="text-muted d-block mt-1">
                      Progress mode: {courseWorkflow.progress_mode.replace(/_/g, ' ')}
                    </small>
                  )}
                </div>
              )}
              
              {/* Step History */}
              {courseWorkflow.history && courseWorkflow.history.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-primary">
                    <small>View Step History ({courseWorkflow.history.length} steps)</small>
                  </summary>
                  <div className="mt-2">
                    {courseWorkflow.history.map((historyItem, index) => (
                      <div key={index} className="border-start border-2 border-secondary ps-3 pb-2 small">
                        <div className="d-flex justify-content-between">
                          <strong>{historyItem.step_name}</strong>
                          <Badge color="secondary" pill size="sm">
                            {historyItem.status}
                          </Badge>
                        </div>
                        {historyItem.completed_at && (
                          <div className="text-muted">
                            {new Date(historyItem.completed_at).toLocaleString()}
                          </div>
                        )}
                        {historyItem.notes && (
                          <div className="text-muted fst-italic">
                            {historyItem.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            // No workflow - show apply options
            <div className="no-workflow">
              <Alert color="info" className="mb-3">
                <FaExclamationCircle className="me-2" />
                No workflow has been applied to this submission yet.
                {availableTemplates.length === 0 && ' No active course workflow templates are available.'}
              </Alert>
              
              {availableTemplates.length > 0 && (
                <div>
                  <p className="mb-2"><strong>Apply a workflow template:</strong></p>
                  <div className="d-flex flex-wrap gap-2">
                    {availableTemplates.map(template => (
                      <Button
                        key={template.id}
                        color="primary"
                        outline
                        size="sm"
                        onClick={() => handleApplyWorkflow(template.id)}
                        disabled={workflowsLoading}
                      >
                        {template.template_name || template.name}
                        {template.category && ` (${template.category})`}
                      </Button>
                    ))}
                  </div>
                  <small className="text-muted d-block mt-2">
                    Applying a workflow will automatically start processing this submission through the defined steps.
                  </small>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Statistics */}
      <div className="statistics mb-4">
        <StatCard 
          label="Total Items" 
          value={statistics.totalItems}
          icon={FaBook}
        />
        <StatCard 
          label="Pending" 
          value={statistics.byStatus.pending}
          color="warning"
          icon={FaClock}
        />
        <StatCard 
          label="In Progress" 
          value={statistics.byStatus.inProgress}
          color="info"
        />
        <StatCard 
          label="Complete" 
          value={statistics.byStatus.complete}
          color="success"
          icon={FaCheckCircle}
        />
        <StatCard 
          label="Unavailable" 
          value={statistics.byStatus.unavailable}
          color="danger"
          icon={FaExclamationCircle}
        />
        <StatCard 
          label="Progress" 
          value={`${statistics.completionPercentage}%`}
          color="primary"
        />
      </div>


      {/* Folders */}
      {folders.map((folder, folderIndex) => (
        <Card key={folder.name} className="folder-section mb-3">
          <CardBody>
            <div className="folder-header">
              <h3>
                <span className="folder-number">{folderIndex + 1}.</span>
                <FaFolder className="folder-icon ms-2" />
                {folder.name}
              </h3>
              <Badge color="secondary" pill>
                {folder.items.length} items
              </Badge>
            </div>
            <div className="item-list">
              {folder.items.map((item) => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  displayNumber={itemDisplayNumbers[item.id]}
                  onClaim={handleClaim}
                  onGoToWork={handleGoToWork}
                  onReopen={handleReopen}
                  currentUserId={currentUser?.id || 0}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* Unfoldered Items */}
      {unfolderedItems.length > 0 && (
        <Card className="folder-section">
          <CardBody>
                        <div className="item-list">
              {unfolderedItems.map((item) => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  displayNumber={itemDisplayNumbers[item.id]}
                  onClaim={handleClaim}
                  onGoToWork={handleGoToWork}
                  onReopen={handleReopen}
                  currentUserId={currentUser?.id || 0}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default SubmissionDetail;

/**
 * @file WorkflowPanel.jsx
 * @description Display and manage workflow execution for course and resource items
 */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  Progress,
  Badge,
  Alert,
  Spinner,
  Button,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import { 
  FaCheckCircle,
  FaClock,
  FaPlay,
  FaExclamationTriangle,
  FaRobot,
  FaLock,
  FaBan,
  FaEllipsisH,
  FaUser
} from 'react-icons/fa';
import { workflowService } from '../../../services/admin/workflowService';
import { toast } from 'react-toastify';
import './WorkflowPanel.css';

const WorkflowPanel = ({ submissionId, resourceId, item }) => {
  const [courseWorkflow, setCourseWorkflow] = useState(null);
  const [resourceWorkflow, setResourceWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [instanceSteps, setInstanceSteps] = useState({});
  const [pendingActions, setPendingActions] = useState({});
  const [folioInputs, setFolioInputs] = useState({});
  const [gatedBlockers, setGatedBlockers] = useState({});
  const courseWorkflowId = courseWorkflow?.id;
  const resourceWorkflowId = resourceWorkflow?.id;

  const isActionPending = (instanceId, stepId, action) => Boolean(pendingActions[`${instanceId}-${stepId}-${action}`]);

  // Load workflows for this item
  const loadWorkflows = useCallback(async () => {
    if (!item || !submissionId) return;
    
    setLoading(true);
    try {
      // Load course workflow if submission_id is available
      const courseInstances = await workflowService.listInstances({
        entity_type: 'course',
        submission_id: submissionId
      });
      
      if (courseInstances.length > 0) {
        const courseInstance = await workflowService.getInstance(courseInstances[0].id);
        setCourseWorkflow(courseInstance);
      } else {
        // Auto-create course workflow if it doesn't exist
        try {
          const newInstance = await workflowService.autoCreateWorkflow(
            submissionId,
            submissionId,
            'course',
            'course'
          );
          const courseInstance = await workflowService.getInstance(newInstance.id);
          setCourseWorkflow(courseInstance);
        } catch (error) {
          console.error('No course workflow template available:', error);
          setCourseWorkflow(null);
        }
      }

      // Load resource workflow if resource_id is available
      if (resourceId) {
        const resourceInstances = await workflowService.listInstances({
          entity_type: 'item',
          entity_id: resourceId,
          submission_id: submissionId
        });
        
        if (resourceInstances.length > 0) {
          const resourceInstance = await workflowService.getInstance(resourceInstances[0].id);
          setResourceWorkflow(resourceInstance);
        } else {
          // Auto-create resource workflow based on material type
          try {
            const category = item.materialTypeName?.toLowerCase() || 'default';
            const newInstance = await workflowService.autoCreateWorkflow(
              submissionId,
              resourceId,
              category,
              'item'
            );
            const resourceInstance = await workflowService.getInstance(newInstance.id);
            setResourceWorkflow(resourceInstance);
          } catch (error) {
            console.error('No resource workflow template available:', error);
            setResourceWorkflow(null);
          }
        }
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [item, submissionId, resourceId]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const fetchChecklist = useCallback(async (instanceId) => {
    if (!instanceId) return;

    try {
      const data = await workflowService.getInstanceSteps(instanceId);
      const payload = data?.checklist || data;
      setInstanceSteps((prev) => ({
        ...prev,
        [instanceId]: payload
      }));
    } catch (error) {
      console.error('Failed to load workflow steps:', error);
      toast.error('Failed to load workflow steps');
    }
  }, []);

  useEffect(() => {
    if (courseWorkflowId) {
      fetchChecklist(courseWorkflowId);
    }
  }, [courseWorkflowId, fetchChecklist]);

  useEffect(() => {
    if (resourceWorkflowId) {
      fetchChecklist(resourceWorkflowId);
    }
  }, [resourceWorkflowId, fetchChecklist]);

  const handleStartWorkflow = async (workflowInstance) => {
    try {
      await workflowService.startWorkflow(workflowInstance.id);
      toast.success('Workflow started');
      loadWorkflows(); // Reload to get updated state
    } catch (error) {
      console.error('Failed to start workflow:', error);
      toast.error('Failed to start workflow');
    }
  };

  const handleCompleteChecklistStep = useCallback(async (instanceId, step) => {
    const stepId = step?.id ?? step?.step_id;
    if (!instanceId || !stepId) {
      return;
    }

    const actionKey = `${instanceId}-${stepId}-complete`;
    setPendingActions((prev) => ({
      ...prev,
      [actionKey]: true
    }));

    try {
      await workflowService.transitionStep(instanceId, stepId, { action: 'complete' });
      toast.success(`Step "${step.step_name}" marked complete.`);
      await fetchChecklist(instanceId);
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to transition step:', error);
      if (error.code === 'AUTOMATED_STEP_USE_AUTOMATION_ENDPOINT') {
        toast.error('This step is automated and must be completed using its automation button.');
      } else if (error.code === 'WORKFLOW_GATED') {
        const blockers = error.details?.blockers || [];
        if (blockers.length > 0) {
          setGatedBlockers((prev) => ({
            ...prev,
            [`${instanceId}-${stepId}`]: blockers
          }));
        }
        toast.error(error.message || 'Workflow is gated. Complete prerequisite steps first.');
      } else if (error.code === 'STEP_ALREADY_COMPLETED') {
        toast.info('This step is already completed.');
      } else {
        toast.error(error.message || 'Failed to update step');
      }
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  }, [fetchChecklist, loadWorkflows]);

  const handleRunAutomation = useCallback(async (instanceId, step) => {
    const stepId = step?.id ?? step?.step_id;
    if (!instanceId || !stepId) {
      return;
    }

    const actionKey = `${instanceId}-${stepId}-automation`;
    setPendingActions((prev) => ({
      ...prev,
      [actionKey]: true
    }));

    try {
      await workflowService.runStepAutomation(instanceId, stepId, {
        intent: step.automation_handler || undefined,
        payload: {}
      });
      toast.success(`Automation triggered for "${step.step_name}".`);
      await fetchChecklist(instanceId);
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to run automation:', error);
      if (error.code === 'STEP_ALREADY_COMPLETED') {
        toast.info('This automated step is already completed.');
      } else if (error.code === 'WORKFLOW_GATED') {
        const blockers = error.details?.blockers || [];
        if (blockers.length > 0) {
          setGatedBlockers((prev) => ({
            ...prev,
            [`${instanceId}-${stepId}`]: blockers
          }));
        }
        toast.error(error.message || 'Workflow is gated. Complete prerequisite steps first.');
      } else {
        toast.error(error.message || 'Automation failed to start');
      }
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  }, [fetchChecklist, loadWorkflows]);

  const handleFolioInputChange = (instanceId, stepId, field, value) => {
    const key = `${instanceId}-${stepId}`;
    setFolioInputs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }));
  };

  const handleRunFolioLink = useCallback(async (instanceId, step) => {
    const stepId = step?.id ?? step?.step_id;
    if (!instanceId || !stepId) {
      return;
    }

    const key = `${instanceId}-${stepId}`;
    const { course_id, term_id } = folioInputs[key] || {};

    if (!course_id || !term_id) {
      toast.error('Course ID and Term ID are required to verify and link the course.');
      return;
    }

    const actionKey = `${instanceId}-${stepId}-automation`;
    setPendingActions((prev) => ({
      ...prev,
      [actionKey]: true
    }));

    try {
      await workflowService.runFolioLink(instanceId, stepId, { course_id, term_id });
      toast.success('Course verified and linked in FOLIO.');
      await fetchChecklist(instanceId);
      await loadWorkflows();
    } catch (error) {
      console.error('Failed to run FOLIO link automation:', error);
      if (error.code === 'MISSING_IDENTIFIERS') {
        toast.error(error.message || 'Course and term identifiers are required.');
      } else if (error.code === 'STEP_ALREADY_COMPLETED') {
        toast.info('FOLIO verification already completed for this step.');
      } else if (error.code === 'WORKFLOW_GATED') {
        const blockers = error.details?.blockers || [];
        if (blockers.length > 0) {
          setGatedBlockers((prev) => ({
            ...prev,
            [`${instanceId}-${stepId}`]: blockers
          }));
        }
        toast.error(error.message || 'Workflow is gated. Complete prerequisite steps first.');
      } else {
        toast.error(error.message || 'FOLIO verification failed.');
      }
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[actionKey];
        return next;
      });
    }
  }, [fetchChecklist, loadWorkflows, folioInputs]);

  const renderChecklist = (workflow, checklist) => {
    if (!workflow) {
      return null;
    }

    const workflowId = workflow.id ?? workflow.instance_id;

    if (!checklist) {
      return (
        <div className="text-center py-3">
          <Spinner size="sm" color="primary" />
        </div>
      );
    }

    if (!Array.isArray(checklist.steps) || checklist.steps.length === 0) {
      return (
        <Alert color="info" className="mb-0">
          No checklist steps configured for this workflow.
        </Alert>
      );
    }

    const stepLookup = new Map(
      checklist.steps.map((step) => [step.id ?? step.step_id, step])
    );

    const statusBadgeColors = {
      ready: 'primary',
      blocked: 'warning',
      completed: 'success',
      pending: 'secondary',
      in_progress: 'info'
    };

    return (
      <div className="workflow-checklist">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <small className="text-muted">Checklist</small>
          <Badge color="light" className="text-dark">
            {checklist.completed_count ?? 0}/{checklist.total_count ?? checklist.steps.length} complete
          </Badge>
        </div>
        <div className="workflow-steps">
          {checklist.steps.map((step) => {
            const stepId = step.id ?? step.step_id;
            const isGate = step.is_gate === 1 || step.is_gate === true;
            const isAutomated = step.is_automated === 1 || step.is_automated === true || Boolean(step.automation_handler);
            const isFolioGate =
              isGate &&
              isAutomated &&
              step.automation_handler === 'ensure_course_and_offering';
            const isBlocked = step.status === 'blocked';
            const dependencies = Array.isArray(step.depends_on) ? step.depends_on : [];
            const dependencyLabels = dependencies
              .map((dep) => {
                const numericDep = Number(dep);
                const lookupKey = Number.isNaN(numericDep) ? dep : numericDep;
                return stepLookup.get(lookupKey)?.step_name;
              })
              .filter(Boolean);
            const showAutomation = step.status === 'ready' && isAutomated && !isFolioGate;
            const pendingComplete = isActionPending(workflowId, stepId, 'complete');
            const pendingAutomation = isActionPending(workflowId, stepId, 'automation');
            const canComplete = step.status === 'ready';
            const statusBadgeColor = statusBadgeColors[step.status] || 'secondary';
            const description = step.description || step.step_description;
            const blockerKey = `${workflowId}-${stepId}`;
            const blockers = gatedBlockers[blockerKey] || [];

            return (
              <div
                key={stepId}
                className={[
                  'workflow-step',
                  `status-${step.status}`,
                  isGate ? 'gate-step' : '',
                  isBlocked ? 'blocked' : ''
                ].filter(Boolean).join(' ')}
              >
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <strong>{step.step_name}</strong>
                      {isGate && (
                        <Badge color="dark" pill>
                          Gate
                        </Badge>
                      )}
                      <Badge color={statusBadgeColor} pill className="text-uppercase">
                        {step.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {description && (
                      <div className="text-muted small mb-1">
                        {description}
                      </div>
                    )}
                    {dependencyLabels.length > 0 && (
                      <div className="text-muted small">
                        <FaLock className="me-1" />
                        Blocked by: {dependencyLabels.join(', ')}
                      </div>
                    )}
                    {showAutomation && step.automation_handler && (
                      <div className="text-muted small">
                        <FaRobot className="me-1" />
                        Automation: <code>{step.automation_handler}</code>
                      </div>
                    )}
                  </div>
                  <div className="workflow-step-actions text-nowrap">
                    {!isFolioGate && (
                      <Button
                        color="success"
                        size="sm"
                        disabled={!canComplete || pendingComplete}
                        onClick={() => handleCompleteChecklistStep(workflowId, step)}
                      >
                        {pendingComplete ? (
                          <Spinner size="sm" color="light" />
                        ) : (
                          <FaCheckCircle className="me-1" />
                        )}
                        Mark Complete
                      </Button>
                    )}
                    {showAutomation && (
                      <Button
                        color="info"
                        size="sm"
                        outline
                        disabled={pendingAutomation}
                        onClick={() => handleRunAutomation(workflowId, step)}
                      >
                        {pendingAutomation ? (
                          <Spinner size="sm" color="info" />
                        ) : (
                          <FaRobot className="me-1" />
                        )}
                        Run Automation
                      </Button>
                    )}
                    {/* Manual actions dropdown / secondary controls */}
                    {!isAutomated && (
                      <div className="btn-group ms-2">
                        <Button
                          color="secondary"
                          size="sm"
                          outline
                          disabled={isActionPending(workflowId, stepId, 'start')}
                          onClick={async () => {
                            const actionKey = `${workflowId}-${stepId}-start`;
                            setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
                            try {
                              await workflowService.transitionStep(workflowId, stepId, { action: 'start' });
                              await fetchChecklist(workflowId);
                              await loadWorkflows();
                            } catch (error) {
                              console.error('Failed to start step:', error);
                              if (error.code === 'WORKFLOW_GATED') {
                                const blockersLocal = error.details?.blockers || [];
                                if (blockersLocal.length > 0) {
                                  setGatedBlockers((prev) => ({
                                    ...prev,
                                    [blockerKey]: blockersLocal
                                  }));
                                }
                              }
                              toast.error(error.message || 'Failed to start step');
                            } finally {
                              setPendingActions((prev) => {
                                const next = { ...prev };
                                delete next[actionKey];
                                return next;
                              });
                            }
                          }}
                        >
                          <FaPlay className="me-1" />
                          Start
                        </Button>

                        <UncontrolledDropdown group>
                          <DropdownToggle
                            caret
                            size="sm"
                            color="secondary"
                            outline
                            disabled={
                              isActionPending(workflowId, stepId, 'block') ||
                              isActionPending(workflowId, stepId, 'skip') ||
                              isActionPending(workflowId, stepId, 'revert') ||
                              isActionPending(workflowId, stepId, 'assign')
                            }
                          >
                            <FaEllipsisH />
                          </DropdownToggle>
                          <DropdownMenu end>
                            <DropdownItem
                              onClick={async () => {
                                const reason = window.prompt('Reason for blocking this step?');
                                if (!reason) return;
                                const actionKey = `${workflowId}-${stepId}-block`;
                                setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
                                try {
                                  await workflowService.transitionStep(workflowId, stepId, {
                                    action: 'block',
                                    reason
                                  });
                                  await fetchChecklist(workflowId);
                                  await loadWorkflows();
                                } catch (error) {
                                  console.error('Failed to block step:', error);
                                  if (error.code === 'WORKFLOW_GATED') {
                                    const blockersLocal = error.details?.blockers || [];
                                    if (blockersLocal.length > 0) {
                                      setGatedBlockers((prev) => ({
                                        ...prev,
                                        [blockerKey]: blockersLocal
                                      }));
                                    }
                                  }
                                  toast.error(error.message || 'Failed to block step');
                                } finally {
                                  setPendingActions((prev) => {
                                    const next = { ...prev };
                                    delete next[actionKey];
                                    return next;
                                  });
                                }
                              }}
                            >
                              <FaBan className="me-2" />
                              Block Step
                            </DropdownItem>
                            <DropdownItem
                              onClick={async () => {
                                const reason = window.prompt('Reason for skipping this step?');
                                if (!reason) return;
                                const actionKey = `${workflowId}-${stepId}-skip`;
                                setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
                                try {
                                  await workflowService.transitionStep(workflowId, stepId, {
                                    action: 'skip',
                                    reason
                                  });
                                  await fetchChecklist(workflowId);
                                  await loadWorkflows();
                                } catch (error) {
                                  console.error('Failed to skip step:', error);
                                  toast.error(error.message || 'Failed to skip step');
                                } finally {
                                  setPendingActions((prev) => {
                                    const next = { ...prev };
                                    delete next[actionKey];
                                    return next;
                                  });
                                }
                              }}
                            >
                              <FaBan className="me-2" />
                              Skip Step
                            </DropdownItem>
                            <DropdownItem
                              onClick={async () => {
                                const confirmRevert = window.confirm('Revert this step to a previous state?');
                                if (!confirmRevert) return;
                                const actionKey = `${workflowId}-${stepId}-revert`;
                                setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
                                try {
                                  await workflowService.transitionStep(workflowId, stepId, {
                                    action: 'revert'
                                  });
                                  await fetchChecklist(workflowId);
                                  await loadWorkflows();
                                } catch (error) {
                                  console.error('Failed to revert step:', error);
                                  toast.error(error.message || 'Failed to revert step');
                                } finally {
                                  setPendingActions((prev) => {
                                    const next = { ...prev };
                                    delete next[actionKey];
                                    return next;
                                  });
                                }
                              }}
                            >
                              <FaClock className="me-2" />
                              Revert Step
                            </DropdownItem>
                            <DropdownItem
                              onClick={async () => {
                                const assigneeRole = window.prompt('Assign to role (optional):');
                                const assigneeUserId = window.prompt('Assign to user ID (optional):');
                                if (!assigneeRole && !assigneeUserId) return;
                                const actionKey = `${workflowId}-${stepId}-assign`;
                                setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
                                try {
                                  await workflowService.transitionStep(workflowId, stepId, {
                                    action: 'assign',
                                    assignee_role: assigneeRole || undefined,
                                    assignee_user_id: assigneeUserId || undefined
                                  });
                                  await fetchChecklist(workflowId);
                                  await loadWorkflows();
                                } catch (error) {
                                  console.error('Failed to assign step:', error);
                                  toast.error(error.message || 'Failed to assign step');
                                } finally {
                                  setPendingActions((prev) => {
                                    const next = { ...prev };
                                    delete next[actionKey];
                                    return next;
                                  });
                                }
                              }}
                            >
                              <FaUser className="me-2" />
                              Assign Step
                            </DropdownItem>
                          </DropdownMenu>
                        </UncontrolledDropdown>
                      </div>
                    )}
                  </div>
                </div>
                {isFolioGate && (
                  <div className="mt-2">
                    <div className="d-flex flex-column flex-md-row align-items-start gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Course ID"
                        value={(folioInputs[`${workflowId}-${stepId}`]?.course_id) || ''}
                        onChange={(e) => handleFolioInputChange(workflowId, stepId, 'course_id', e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Term ID"
                        value={(folioInputs[`${workflowId}-${stepId}`]?.term_id) || ''}
                        onChange={(e) => handleFolioInputChange(workflowId, stepId, 'term_id', e.target.value)}
                      />
                      <Button
                        color="primary"
                        size="sm"
                        disabled={pendingAutomation}
                        onClick={() => handleRunFolioLink(workflowId, step)}
                      >
                        {pendingAutomation ? (
                          <Spinner size="sm" color="light" />
                        ) : (
                          <FaRobot className="me-1" />
                        )}
                        Verify and link course
                      </Button>
                    </div>
                    {workflow.workflow_data?.folio_link && (
                      <small className="text-muted d-block mt-2">
                        Linked course: {workflow.workflow_data.folio_link.course_id}
                        {workflow.workflow_data.folio_link.course_listing_id &&
                          ` • Listing: ${workflow.workflow_data.folio_link.course_listing_id}`}
                        {workflow.workflow_data.folio_link.term_id &&
                          ` • Term: ${workflow.workflow_data.folio_link.term_id}`}
                        {workflow.workflow_data.folio_link.verified_at &&
                          ` • Verified: ${new Date(workflow.workflow_data.folio_link.verified_at).toLocaleString()}`}
                        {workflow.workflow_data.folio_link.verified_by &&
                          ` • By: ${workflow.workflow_data.folio_link.verified_by}`}
                      </small>
                    )}
                  </div>
                )}
                {blockers.length > 0 && (
                  <Alert color="warning" className="mt-2 mb-0 py-2">
                    <small>
                      <FaExclamationTriangle className="me-1" />
                      This step is gated by:
                      <ul className="mb-0 mt-1">
                        {blockers.map((b, idx) => (
                          <li key={idx}>{b.message || b}</li>
                        ))}
                      </ul>
                    </small>
                  </Alert>
                )}
                {isBlocked && dependencyLabels.length === 0 && (
                  <small className="text-muted d-block mt-2">
                    <FaBan className="me-1" />
                    This step is blocked until prerequisite steps finish.
                  </small>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWorkflowCard = (workflow, title) => {
    if (!workflow) return null;

    const statusColor = {
      'not_started': 'secondary',
      'in_progress': 'primary',
      'completed': 'success',
      'on_hold': 'warning',
      'cancelled': 'danger'
    };

    const statusIcon = {
      'not_started': FaClock,
      'in_progress': FaPlay,
      'completed': FaCheckCircle,
      'on_hold': FaExclamationTriangle,
      'cancelled': FaExclamationTriangle
    };

    const Icon = statusIcon[workflow.status] || FaClock;
    const instanceId = workflow.id ?? workflow.instance_id;
    const checklist = instanceSteps[instanceId] || null;
    const progressModeLabel = checklist?.progress_mode
      ? `${checklist.progress_mode.charAt(0).toUpperCase()}${checklist.progress_mode.slice(1)} Mode`
      : null;

    return (
      <Card className="workflow-card mb-3">
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h6 className="mb-1">{title}</h6>
              <small className="text-muted">{workflow.template_name}</small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge color={statusColor[workflow.status]} pill className="d-flex align-items-center gap-1">
                <Icon size={12} />
                {workflow.status.replace('_', ' ')}
              </Badge>
              {progressModeLabel && (
                <Badge color="light" className="text-dark text-capitalize">
                  {progressModeLabel}
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted">Progress</small>
              <small className="fw-bold">{workflow.progress_percentage}%</small>
            </div>
            <Progress 
              value={workflow.progress_percentage} 
              color={workflow.progress_percentage === 100 ? 'success' : 'primary'}
              style={{ height: '8px' }}
            />
          </div>

          <div className="mt-3">
            {renderChecklist(workflow, checklist)}
          </div>

          {/* Current Step */}
          {workflow.current_step_name && (
            <div className="mb-3">
              <small className="text-muted d-block mb-1">Current Step:</small>
              <div className="fw-semibold">{workflow.current_step_name}</div>
            </div>
          )}

          {/* History */}
          {workflow.history && workflow.history.length > 0 && (
            <div className="workflow-history mt-3 pt-3 border-top">
              <small className="text-muted d-block mb-2">History:</small>
              <div className="history-list">
                {workflow.history.slice(-3).reverse().map((entry) => (
                  <div key={entry.id} className="history-item mb-2 pb-2 border-bottom">
                    <div className="d-flex align-items-start gap-2">
                      {entry.status === 'completed' ? (
                        <FaCheckCircle className="text-success mt-1" size={14} />
                      ) : (
                        <FaClock className="text-secondary mt-1" size={14} />
                      )}
                      <div className="flex-grow-1">
                        <div className="small fw-semibold">{entry.step_name}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {entry.completed_by_name && `${entry.completed_by_name} • `}
                          {entry.completed_at && new Date(entry.completed_at).toLocaleString()}
                          {entry.duration_minutes && ` • ${entry.duration_minutes} min`}
                        </div>
                        {entry.notes && (
                          <div className="small text-muted mt-1">{entry.notes}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {workflow.history.length > 3 && (
                <small className="text-muted">
                  Showing last 3 of {workflow.history.length} steps
                </small>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {workflow.status === 'not_started' && (
            <div className="mt-3">
              <Button 
                color="primary" 
                size="sm" 
                onClick={() => handleStartWorkflow(workflow)}
                block
              >
                <FaPlay className="me-1" />
                Start Workflow
              </Button>
            </div>
          )}

          {workflow.status === 'in_progress' && (
            <div className="mt-3">
              <Button 
                color="primary" 
                size="sm" 
                onClick={() => {
                  // Navigate to detailed workflow execution view
                  toast.info('Full workflow execution interface coming soon');
                }}
                block
              >
                Continue Working
              </Button>
            </div>
          )}

          {workflow.status === 'completed' && workflow.completed_at && (
            <div className="mt-3 text-center">
              <small className="text-success">
                <FaCheckCircle className="me-1" />
                Completed {new Date(workflow.completed_at).toLocaleDateString()}
              </small>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  if (!item) {
    return (
      <Alert color="info" className="mb-0">
        Select an item to view workflow
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner color="primary" />
        <p className="mt-3 text-muted">Loading workflows...</p>
      </div>
    );
  }

  const overallProgress = courseWorkflow && resourceWorkflow
    ? Math.round((courseWorkflow.progress_percentage + resourceWorkflow.progress_percentage) / 2)
    : courseWorkflow 
      ? courseWorkflow.progress_percentage 
      : resourceWorkflow?.progress_percentage || 0;

  return (
    <div className="workflow-panel">
      {/* Overall Progress Summary */}
      <Card className="mb-3 bg-light">
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">Overall Progress</h6>
            <Badge color={overallProgress === 100 ? 'success' : 'primary'} pill>
              {overallProgress}%
            </Badge>
          </div>
          <Progress 
            value={overallProgress} 
            color={overallProgress === 100 ? 'success' : 'primary'}
            style={{ height: '12px' }}
          />
          <small className="text-muted mt-2 d-block">
            {overallProgress === 100 
              ? 'All workflows completed!' 
              : 'Complete all steps to finish processing this item'}
          </small>
        </CardBody>
      </Card>

      {/* Course Workflow */}
      {courseWorkflow && renderWorkflowCard(courseWorkflow, 'Course Setup')}

      {/* Resource Workflow */}
      {resourceWorkflow && renderWorkflowCard(
        resourceWorkflow, 
        `${item.materialTypeName || 'Resource'} Processing`
      )}

      {/* No Workflows Available */}
      {!courseWorkflow && !resourceWorkflow && (
        <Alert color="warning">
          <FaExclamationTriangle className="me-2" />
          <strong>No workflows configured</strong>
          <p className="mb-0 mt-2 small">
            Contact your administrator to set up workflow templates for this item type.
          </p>
        </Alert>
      )}

      {/* Info Footer */}
      <Alert color="secondary" className="mt-3 mb-0">
        <small>
          <FaCheckCircle className="me-2" />
          <strong>Workflow System Active</strong>
          <p className="mb-0 mt-1">
            This workflow system uses automated templates based on material type. 
            Contact your administrator to customize workflows.
          </p>
        </small>
      </Alert>
    </div>
  );
};

WorkflowPanel.propTypes = {
  submissionId: PropTypes.number.isRequired,
  resourceId: PropTypes.number,
  item: PropTypes.object
};

export default WorkflowPanel;

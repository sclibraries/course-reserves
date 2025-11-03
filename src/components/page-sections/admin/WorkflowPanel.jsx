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
  Button
} from 'reactstrap';
import { 
  FaCheckCircle,
  FaClock,
  FaPlay,
  FaExclamationTriangle
} from 'react-icons/fa';
import { workflowService } from '../../../services/admin/workflowService';
import { toast } from 'react-toastify';
import './WorkflowPanel.css';

const WorkflowPanel = ({ submissionId, resourceId, item }) => {
  const [courseWorkflow, setCourseWorkflow] = useState(null);
  const [resourceWorkflow, setResourceWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);

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

    return (
      <Card className="workflow-card mb-3">
        <CardBody>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h6 className="mb-1">{title}</h6>
              <small className="text-muted">{workflow.template_name}</small>
            </div>
            <Badge color={statusColor[workflow.status]} pill className="d-flex align-items-center gap-1">
              <Icon size={12} />
              {workflow.status.replace('_', ' ')}
            </Badge>
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

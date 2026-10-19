import { useCallback, useState } from 'react';
import { getFlowErrorMessage } from '../../services/admin/workflowFlows/flowFormatters';
import { workflowFlowsApi } from '../../services/admin/workflowFlows/workflowFlowsApi';

function parseFlowId(value) {
  const numericId = Number(value);
  return Number.isFinite(numericId) ? numericId : value;
}

function useSwitchFlow({ item, canAct, onFlowStateChange, onChanged, clearItemError }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const clearError = useCallback(() => setError(''), []);

  const openSwitchFlow = useCallback(async () => {
    setOpen(true);
    setError('');
    clearItemError?.();
    if (flows.length || loading) return;

    setLoading(true);
    try {
      const result = await workflowFlowsApi.getFlows();
      setFlows(result?.flows || []);
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [clearItemError, flows.length, loading]);

  const submitSwitchFlow = useCallback(async () => {
    if (!selectedFlow || !reason.trim() || !canAct) return false;

    setPending(true);
    setError('');
    try {
      const result = await workflowFlowsApi.switchFlow(item.kind, item.id, {
        flow_id: parseFlowId(selectedFlow),
        reason: reason.trim(),
      });
      onFlowStateChange?.(result);
      setOpen(false);
      setReason('');
      await onChanged?.();
      return true;
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
      return false;
    } finally {
      setPending(false);
    }
  }, [canAct, item.kind, item.id, onChanged, onFlowStateChange, reason, selectedFlow]);

  return {
    open, loading, flows, selectedFlow, reason, pending, error,
    openSwitchFlow, setSelectedFlow, setReason, submitSwitchFlow, clearError,
  };
}

export default useSwitchFlow;

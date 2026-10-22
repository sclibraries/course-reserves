import { useCallback, useState } from 'react';
import { getFlowErrorMessage } from '../../services/admin/workflowFlows/flowFormatters';
import { workflowFlowsApi } from '../../services/admin/workflowFlows/workflowFlowsApi';
import useMutation from './useMutation';

function parseFlowId(value) {
  const numericId = Number(value);
  return Number.isFinite(numericId) ? numericId : value;
}

function useSwitchFlow({ item, canAct, onFlowStateChange, onChanged, clearItemError }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState('');
  const { pending, error, setError, run } = useMutation(getFlowErrorMessage);

  const clearError = useCallback(() => setError(''), [setError]);
  const closeSwitchFlow = useCallback(() => {
    setOpen(false);
    setSelectedFlow('');
    clearError();
  }, [clearError]);

  const openSwitchFlow = useCallback(async () => {
    setOpen(true);
    setError('');
    clearItemError?.();
    if (flows.length || loading) return;

    setLoading(true);
    try {
      const result = await workflowFlowsApi.getFlows();
      setFlows(result.flows);
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [clearItemError, flows.length, loading, setError]);

  const submitSwitchFlow = useCallback(async (reasonValue) => {
    const reason = reasonValue.trim();
    if (!selectedFlow || !reason || !canAct) return false;

    const result = await run(() => workflowFlowsApi.switchFlow(item.kind, item.id, {
        flow_id: parseFlowId(selectedFlow),
        reason: reason.trim(),
      }), {
      reload: onChanged,
      onSuccess: (flow) => {
        onFlowStateChange?.(flow);
        setOpen(false);
      },
    });
    return result !== null;
  }, [canAct, item.kind, item.id, onChanged, onFlowStateChange, run, selectedFlow]);

  return {
    open, loading, flows, selectedFlow, pending, error, canAct,
    openSwitchFlow, closeSwitchFlow, setSelectedFlow, submitSwitchFlow, clearError,
  };
}

export default useSwitchFlow;

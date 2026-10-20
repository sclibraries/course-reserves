import { useCallback, useEffect, useState } from 'react';
import { getFlowErrorCode, getFlowErrorMessage } from '../../services/admin/workflowFlows/flowFormatters';
import { buildStepResultBody, outcomeNeedsConfirmation } from '../../services/admin/workflowFlows/flowRules';
import { workflowFlowsApi } from '../../services/admin/workflowFlows/workflowFlowsApi';

function useItemFlow({ item, onChanged }) {
  const [flowState, setFlowState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const resetForm = useCallback(() => {
    setSelectedOutcome(null);
    setNotes('');
    setReason('');
  }, []);

  const loadFlow = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFlowState(await workflowFlowsApi.getItemFlow(item.kind, item.id));
    } catch (requestError) {
      setError(getFlowErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [item.kind, item.id]);

  useEffect(() => { loadFlow(); }, [loadFlow]);

  const submitOutcome = useCallback(async (outcome, { notes = '', reason = '', onStale } = {}) => {
    const step = flowState?.current_step?.step;
    if (!step || !flowState?.can_act) return false;

    setPending(true);
    setError('');
    setNotice('');
    try {
      const result = await workflowFlowsApi.submitStepResult(
        item.kind,
        item.id,
        buildStepResultBody(step, outcome, notes, reason),
      );
      setFlowState(result);
      resetForm();
      await onChanged?.();
      return true;
    } catch (requestError) {
      const code = getFlowErrorCode(requestError);
      const message = getFlowErrorMessage(requestError);
      if (code === 'stale_step') {
        onStale?.();
        resetForm();
        setNotice(message);
        await loadFlow();
      } else if (code === 'step_not_available_yet') {
        setNotice(message);
      } else {
        setError(message);
      }
      return false;
    } finally {
      setPending(false);
    }
  }, [flowState, item.kind, item.id, loadFlow, onChanged, resetForm]);

  const handleOutcome = useCallback((outcome) => {
    if (!flowState?.can_act) return;
    setError('');
    setNotice('');
    if (outcomeNeedsConfirmation(outcome)) {
      setSelectedOutcome(outcome);
      setReason('');
      return;
    }
    submitOutcome(outcome, { notes, reason });
  }, [flowState, notes, reason, submitOutcome]);

  const confirmOutcome = useCallback(() => {
    if (selectedOutcome) submitOutcome(selectedOutcome, { notes, reason });
  }, [notes, reason, selectedOutcome, submitOutcome]);

  const cancelOutcome = useCallback(() => setSelectedOutcome(null), []);

  const replaceFlowState = useCallback((nextState) => {
    setFlowState(nextState);
    setError('');
  }, []);

  const clearError = useCallback(() => setError(''), []);
  const clearNotice = useCallback(() => setNotice(''), []);

  return {
    flowState, loading, pending, error, notice, selectedOutcome, notes, reason,
    loadFlow, submitOutcome, handleOutcome, confirmOutcome, cancelOutcome,
    setNotes, setReason, replaceFlowState, clearError, clearNotice,
  };
}

export default useItemFlow;

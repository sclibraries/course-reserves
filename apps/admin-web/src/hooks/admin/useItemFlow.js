import { useCallback, useEffect, useState } from 'react';
import { notify } from '../../services/notify';
import { getFlowErrorCode, getFlowErrorMessage } from '../../services/admin/workflowFlows/flowFormatters';
import { buildStepResultBody, outcomeNeedsConfirmation } from '../../services/admin/workflowFlows/flowRules';
import { workflowFlowsApi } from '../../services/admin/workflowFlows/workflowFlowsApi';
import useMutation from './useMutation';

function useItemFlow({ item, onChanged }) {
  const [flowState, setFlowState] = useState(null);
  const [loading, setLoading] = useState(true);
  const { pending, error, setError, run } = useMutation(() => '');
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
  }, [item.kind, item.id, setError]);

  useEffect(() => { loadFlow(); }, [loadFlow]);

  const submitOutcome = useCallback(async (outcome, { notes = '', reason = '', onStale } = {}) => {
    const step = flowState?.current_step?.step;
    if (!step || !flowState?.can_act) return false;

    setError('');
    setNotice('');
    let failure;
    const result = await run(
      () => workflowFlowsApi.submitStepResult(
        item.kind,
        item.id,
        buildStepResultBody(step, outcome, notes, reason),
      ),
      {
        successMessage: `Recorded ${step.label}`,
        reload: onChanged,
        onSuccess: (nextFlowState) => {
          setFlowState(nextFlowState);
          resetForm();
        },
        onError: (requestError) => {
          failure = requestError;
          notify.fromError(requestError, `Couldn't record ${step.label}`);
        },
      },
    );
    if (result === null) {
      const code = getFlowErrorCode(failure);
      const message = getFlowErrorMessage(failure);
      if (code === 'stale_step') {
        onStale?.();
        resetForm();
        setNotice(message);
        await loadFlow();
      } else if (code === 'step_not_available_yet') {
        setNotice(message);
      }
    }
    return result !== null;
  }, [flowState, item.kind, item.id, loadFlow, onChanged, resetForm, run, setError]);

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
  }, [flowState, notes, reason, setError, submitOutcome]);

  const confirmOutcome = useCallback(() => {
    if (selectedOutcome) submitOutcome(selectedOutcome, { notes, reason });
  }, [notes, reason, selectedOutcome, submitOutcome]);

  const cancelOutcome = useCallback(() => setSelectedOutcome(null), []);

  const replaceFlowState = useCallback((nextState) => {
    setFlowState(nextState);
    setError('');
  }, [setError]);

  const clearError = useCallback(() => setError(''), [setError]);
  const clearNotice = useCallback(() => setNotice(''), []);

  return {
    flowState, loading, pending, error, notice, selectedOutcome, notes, reason,
    loadFlow, submitOutcome, handleOutcome, confirmOutcome, cancelOutcome,
    setNotes, setReason, replaceFlowState, clearError, clearNotice,
  };
}

export default useItemFlow;

import { useState } from 'react';
import { claimsApi } from '../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage } from '../../services/admin/workflowClaims/claimsFormatters';
import { staffGroupsApi } from '../../services/admin/staffGroupsApi';
import { notify } from '../../services/notify';
import useLazyLoad from './useLazyLoad';
import useMutation from './useMutation';

function useItemClaimActions({ item, currentUsername, onChanged }) {
  const { pending, error, setError, run } = useMutation();
  const staff = useLazyLoad(async () => (await claimsApi.getStaff('')).items);
  const groups = useLazyLoad(async () => (await staffGroupsApi.getGroupsForHandoff()).groups);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffTargetType, setHandoffTargetType] = useState('person');
  const [toUsername, setToUsername] = useState('');
  const [toGroupId, setToGroupId] = useState('');
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const isClaimed = Boolean(item.claimed_by);
  const isMine = Boolean(currentUsername && item.claimed_by === currentUsername);

  const runAction = (pendingKey, request, successMessage, toastFailure = false) => run(request, {
    pendingKey,
    successMessage,
    reload: onChanged,
    onError: (requestError) => {
      if (requestError?.payload?.error_code === 'already_claimed') onChanged?.();
      if (toastFailure) notify.fromError(requestError, getClaimsErrorMessage(requestError));
    },
  });

  const openHandoff = async () => {
    setHandoffOpen(true);
    setError('');
    if (staff.loaded || staff.loading) return;
    try {
      await staff.load();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    }
  };

  const changeHandoffTargetType = async (targetType) => {
    setHandoffTargetType(targetType);
    if (targetType !== 'group' || groups.loaded || groups.loading) return;
    try {
      await groups.load();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    }
  };

  const submitHandoff = async () => {
    const body = handoffTargetType === 'group'
      ? (toGroupId ? { to_group_id: Number(toGroupId) } : null)
      : (toUsername ? { to_username: toUsername } : null);
    if (!body) return;
    const targetName = handoffTargetType === 'group'
      ? groups.data.find(({ id }) => String(id) === toGroupId)?.name
      : staff.data.find(({ username }) => username === toUsername)?.display_name;
    if (await runAction('handoff', () => claimsApi.handoffItem(item.kind, item.id, body), `Handed off to ${targetName}`)) {
      setHandoffOpen(false);
    }
  };

  const submitTakeover = async (reasonValue) => {
    const reason = reasonValue.trim();
    if (!reason) return false;
    return Boolean(await runAction('takeover', () => claimsApi.takeoverItem(item.kind, item.id, { reason }), 'Item taken over'));
  };

  return {
    pending, error, isClaimed, isMine,
    staff, groups,
    handoffOpen, handoffTargetType, toUsername, toGroupId,
    takeoverOpen,
    claim: () => runAction('claim', () => claimsApi.claimItem(item.kind, item.id), 'Item claimed', true),
    release: () => runAction('release', () => claimsApi.releaseItem(item.kind, item.id), 'Item released', true),
    openHandoff,
    closeHandoff: () => setHandoffOpen(false),
    changeHandoffTargetType,
    setToUsername,
    setToGroupId,
    submitHandoff,
    openTakeover: () => { setError(''); setTakeoverOpen(true); },
    closeTakeover: () => setTakeoverOpen(false),
    submitTakeover,
  };
}

export default useItemClaimActions;

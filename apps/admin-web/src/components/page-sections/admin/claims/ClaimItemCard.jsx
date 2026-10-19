import { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Form, FormGroup, Input, Label, Spinner } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage } from '../../../../services/admin/workflowClaims/claimsFormatters';
import { staffGroupsApi } from '../../../../services/admin/staffGroupsApi';
import WorkflowTimeline from '../linking/WorkflowTimeline';
import ClaimItemSummary from './ClaimItemSummary';
import ItemFlowPanel from './ItemFlowPanel';

function ClaimItemCard({ item, currentUsername = '', onChanged }) {
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [toUsername, setToUsername] = useState('');
  const [handoffTargetType, setHandoffTargetType] = useState('person');
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [toGroupId, setToGroupId] = useState('');
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const [takeoverReason, setTakeoverReason] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoaded, setTimelineLoaded] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineError, setTimelineError] = useState('');
  const [flowOpen, setFlowOpen] = useState(false);

  const isClaimed = Boolean(item.claimed_by);
  const isMine = Boolean(currentUsername && item.claimed_by === currentUsername);
  const runAction = async (action, request) => {
    setPending(action);
    setError('');
    try {
      await request();
      await onChanged?.();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
      if (requestError?.payload?.error_code === 'already_claimed') await onChanged?.();
    } finally {
      setPending('');
    }
  };

  const openHandoff = async () => {
    setHandoffOpen(true);
    setError('');
    if (staff.length) return;
    setStaffLoading(true);
    try {
      const result = await claimsApi.getStaff('');
      setStaff(result?.items || []);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setStaffLoading(false);
    }
  };

  const submitHandoff = (event) => {
    event.preventDefault();
    if (handoffTargetType === 'person' && !toUsername) return;
    if (handoffTargetType === 'group' && !toGroupId) return;
    const body = handoffTargetType === 'group' ? { to_group_id: Number(toGroupId) } : { to_username: toUsername };
    runAction('handoff', () => claimsApi.handoffItem(item.kind, item.id, body));
  };

  const changeHandoffTargetType = async (event) => {
    const targetType = event.target.value;
    setHandoffTargetType(targetType);
    if (targetType !== 'group' || groups.length || groupsLoading) return;
    setGroupsLoading(true);
    try {
      const result = await staffGroupsApi.getGroupsForHandoff();
      setGroups(result?.groups || []);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setGroupsLoading(false);
    }
  };

  const submitTakeover = (event) => {
    event.preventDefault();
    if (!takeoverReason.trim()) return;
    runAction('takeover', () => claimsApi.takeoverItem(item.kind, item.id, { reason: takeoverReason.trim() }));
  };

  const toggleTimeline = async () => {
    const nextOpen = !timelineOpen;
    setTimelineOpen(nextOpen);
    if (!nextOpen || timelineLoaded) return;
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const result = await claimsApi.getItemTimeline(item.kind, item.id);
      setTimelineEvents(result?.items || []);
      setTimelineLoaded(true);
    } catch (requestError) {
      setTimelineError(getClaimsErrorMessage(requestError));
    } finally {
      setTimelineLoading(false);
    }
  };

  return (
    <div className="d-grid gap-2" data-claim-kind={item.kind}>
      <ClaimItemSummary item={item}>
        <div className="d-flex flex-wrap justify-content-end gap-2">
          {!isClaimed && (
            <Button color="primary" aria-label={`Claim ${item.title}`} disabled={Boolean(pending)} onClick={() => runAction('claim', () => claimsApi.claimItem(item.kind, item.id))}>
              Claim
            </Button>
          )}
          {isMine && (
            <Button color="outline-secondary" aria-label={`Release ${item.title}`} disabled={Boolean(pending)} onClick={() => runAction('release', () => claimsApi.releaseItem(item.kind, item.id))}>
              Release
            </Button>
          )}
          {isClaimed && (
            <Button color="outline-primary" aria-label={`Hand off ${item.title}`} disabled={Boolean(pending)} onClick={openHandoff}>
              Hand off
            </Button>
          )}
          {isClaimed && !isMine && (
            <Button color="warning" aria-label={`Take over ${item.title}`} disabled={Boolean(pending)} onClick={() => setTakeoverOpen((open) => !open)}>
              Take over
            </Button>
          )}
          <Button color="outline-secondary" aria-label={`${flowOpen ? 'Hide' : 'Show'} item flow for ${item.title}`} onClick={() => setFlowOpen((open) => !open)}>
            {flowOpen ? 'Hide item flow' : 'Item flow'}
          </Button>
        </div>
      </ClaimItemSummary>

      {flowOpen && <ItemFlowPanel item={item} onChanged={onChanged} />}

      {error && <Alert color="danger" role="alert">{error}</Alert>}

      {handoffOpen && (
        <Form className="border rounded p-3" onSubmit={submitHandoff}>
          <FormGroup>
            <Label for={`handoff-target-type-${item.kind}-${item.id}`}>Hand off to</Label>
            <Input
              id={`handoff-target-type-${item.kind}-${item.id}`}
              type="select"
              name="handoff-target-type"
              value={handoffTargetType}
              onChange={changeHandoffTargetType}
            >
              <option value="person">A person</option>
              <option value="group">A group</option>
            </Input>
          </FormGroup>
          {handoffTargetType === 'person' && (
            <FormGroup>
              <Label for={`handoff-staff-${item.kind}-${item.id}`}>Staff member</Label>
              {staffLoading ? <Spinner size="sm" /> : (
                <Input
                  id={`handoff-staff-${item.kind}-${item.id}`}
                  type="select"
                  name="to_username"
                  value={toUsername}
                  onChange={(event) => setToUsername(event.target.value)}
                >
                  <option value="">Choose staff</option>
                  {staff.map((person) => <option key={person.username} value={person.username}>{person.display_name}</option>)}
                </Input>
              )}
            </FormGroup>
          )}
          {handoffTargetType === 'group' && (
            <FormGroup>
              <Label for={`handoff-group-${item.kind}-${item.id}`}>Staff group</Label>
              {groupsLoading ? <Spinner size="sm" /> : (
              <Input
                id={`handoff-group-${item.kind}-${item.id}`}
                type="select"
                name="to_group_id"
                value={toGroupId}
                onChange={(event) => setToGroupId(event.target.value)}
              >
                <option value="">Choose group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </Input>
              )}
            </FormGroup>
          )}
          <Button type="submit" data-action="handoff" disabled={!(handoffTargetType === 'group' ? toGroupId : toUsername) || Boolean(pending)}>
            Send handoff
          </Button>
          <Button type="button" color="link" onClick={() => setHandoffOpen(false)}>Cancel</Button>
        </Form>
      )}

      {takeoverOpen && (
        <Form className="border rounded p-3" onSubmit={submitTakeover}>
          <FormGroup>
            <Label for={`takeover-reason-${item.kind}-${item.id}`}>Reason for taking over (required)</Label>
            <Input
              id={`takeover-reason-${item.kind}-${item.id}`}
              type="textarea"
              name="takeover-reason"
              value={takeoverReason}
              onChange={(event) => setTakeoverReason(event.target.value)}
              required
            />
          </FormGroup>
          <Button type="submit" color="warning" data-action="takeover" disabled={!takeoverReason.trim() || Boolean(pending)}>
            Take over item
          </Button>
          <Button type="button" color="link" onClick={() => setTakeoverOpen(false)}>Cancel</Button>
        </Form>
      )}

      <div>
        <Button color="link" className="p-0" aria-label={`Show timeline for ${item.title}`} onClick={toggleTimeline}>
          {timelineOpen ? 'Hide item timeline' : 'Item timeline'}
        </Button>
        {timelineOpen && (
          <div className="mt-2">
            {timelineLoading ? <Spinner size="sm" aria-label="Loading item timeline" /> : (
              <WorkflowTimeline
                events={timelineEvents}
                error={timelineError}
                title={`Item timeline: ${item.title}`}
                id={`item-timeline-${item.kind}-${item.id}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ClaimItemCard.propTypes = {
  item: PropTypes.object.isRequired,
  currentUsername: PropTypes.string,
  onChanged: PropTypes.func,
};

export default ClaimItemCard;

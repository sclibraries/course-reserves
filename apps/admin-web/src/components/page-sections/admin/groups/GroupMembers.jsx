import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Form, FormGroup, Input, Label, Spinner } from 'reactstrap';
import { claimsApi } from '../../../../services/admin/workflowClaims/claimsApi';
import { getClaimsErrorMessage } from '../../../../services/admin/workflowClaims/claimsFormatters';
import { staffGroupsApi } from '../../../../services/admin/staffGroupsApi';

function GroupMembers({ group }) {
  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [memberResult, staffResult] = await Promise.all([
        staffGroupsApi.getMembers(group.id),
        claimsApi.getStaff(''),
      ]);
      setMembers(memberResult?.members || memberResult?.items || []);
      setStaff(staffResult?.items || []);
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!username) return;
    setPending(true);
    setError('');
    try {
      await staffGroupsApi.addMember(group.id, username);
      setUsername('');
      await loadMembers();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async (memberUsername) => {
    setPending(true);
    setError('');
    try {
      await staffGroupsApi.removeMember(group.id, memberUsername);
      await loadMembers();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const memberUsernames = new Set(members.map((member) => member.username));

  return (
    <section className="border rounded p-3 mt-2" aria-label={`${group.name} members`}>
      <h3 className="h6">Members</h3>
      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {loading ? <Spinner size="sm" aria-label="Loading group members" /> : (
        <>
          {!members.length && <p className="text-muted">No members yet.</p>}
          {members.length > 0 && (
            <ul className="list-group mb-3">
              {members.map((member) => {
                const displayName = member.display_name || member.username;
                return (
                  <li className="list-group-item d-flex justify-content-between align-items-center" key={member.username}>
                    <span>{displayName}</span>
                    <Button
                      color="outline-danger"
                      size="sm"
                      aria-label={`Remove ${displayName} from ${group.name}`}
                      disabled={pending}
                      onClick={() => handleRemove(member.username)}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <Form className="d-flex align-items-end gap-2" onSubmit={handleAdd}>
            <FormGroup className="mb-0 flex-grow-1">
              <Label for={`add-member-${group.id}`}>Add staff member</Label>
              <Input
                id={`add-member-${group.id}`}
                type="select"
                name="add-member-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              >
                <option value="">Choose staff</option>
                {staff.filter((person) => !memberUsernames.has(person.username)).map((person) => (
                  <option key={person.username} value={person.username}>{person.display_name || person.username}</option>
                ))}
              </Input>
            </FormGroup>
            <Button type="submit" data-action="add-member" disabled={!username || pending}>Add member</Button>
          </Form>
        </>
      )}
    </section>
  );
}

GroupMembers.propTypes = {
  group: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, name: PropTypes.string.isRequired }).isRequired,
};

export default GroupMembers;

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, FormGroup, Input, Label, Spinner } from 'reactstrap';
import { getClaimsErrorMessage } from '../../../../services/admin/workflowClaims/claimsFormatters';
import { staffGroupsApi } from '../../../../services/admin/staffGroupsApi';
import GroupMembers from './GroupMembers';

function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [membersGroupId, setMembersGroupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await staffGroupsApi.getAllGroups();
      const nextGroups = result?.groups || result?.items || [];
      setGroups(nextGroups);
      setDrafts(Object.fromEntries(nextGroups.map((group) => [group.id, {
        name: group.name || '', description: group.description || '',
      }])));
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!newGroup.name.trim()) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await staffGroupsApi.createGroup({
        name: newGroup.name.trim(),
        ...(newGroup.description.trim() ? { description: newGroup.description.trim() } : {}),
      });
      setNewGroup({ name: '', description: '' });
      setMessage('Group created.');
      await loadGroups();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const handleUpdate = async (event, groupId) => {
    event.preventDefault();
    const draft = drafts[groupId] || {};
    if (!draft.name?.trim()) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await staffGroupsApi.updateGroup(groupId, {
        name: draft.name.trim(),
        ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
      });
      setMessage('Group updated.');
      await loadGroups();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (group) => {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await staffGroupsApi.deleteGroup(group.id);
      if (membersGroupId === group.id) setMembersGroupId(null);
      setMessage('Group deleted.');
      await loadGroups();
    } catch (requestError) {
      setError(getClaimsErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const updateDraft = (groupId, key, value) => {
    setDrafts((current) => ({ ...current, [groupId]: { ...current[groupId], [key]: value } }));
  };

  return (
    <section aria-labelledby="admin-groups-title">
      <h1 id="admin-groups-title" className="h3 mb-1">Groups</h1>
      <p className="text-muted mb-3">Create staff groups and manage their members.</p>
      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {message && <Alert color="success" role="status">{message}</Alert>}
      <Form className="border rounded p-3 mb-4" onSubmit={handleCreate}>
        <h2 className="h5">Create group</h2>
        <div className="row g-2 align-items-end">
          <FormGroup className="col-md-4 mb-0">
            <Label for="new-group-name">Name</Label>
            <Input id="new-group-name" name="new-group-name" value={newGroup.name} onChange={(event) => setNewGroup({ ...newGroup, name: event.target.value })} required />
          </FormGroup>
          <FormGroup className="col-md-6 mb-0">
            <Label for="new-group-description">Description</Label>
            <Input id="new-group-description" name="new-group-description" type="textarea" value={newGroup.description} onChange={(event) => setNewGroup({ ...newGroup, description: event.target.value })} />
          </FormGroup>
          <div className="col-md-2"><Button type="submit" data-action="create-group" disabled={pending || !newGroup.name.trim()}>Create group</Button></div>
        </div>
      </Form>

      {loading ? <Spinner aria-label="Loading groups" /> : groups.length === 0 ? (
        <Alert color="info">No staff groups have been created.</Alert>
      ) : (
        <div className="d-grid gap-3">
          {groups.map((group) => {
            const draft = drafts[group.id] || { name: '', description: '' };
            return (
              <article className="border rounded p-3" key={group.id}>
                <Form className="row g-2 align-items-end" onSubmit={(event) => handleUpdate(event, group.id)}>
                  <FormGroup className="col-md-4 mb-0">
                    <Label for={`group-name-${group.id}`}>Name</Label>
                    <Input id={`group-name-${group.id}`} name={`name-${group.id}`} value={draft.name} onChange={(event) => updateDraft(group.id, 'name', event.target.value)} required />
                  </FormGroup>
                  <FormGroup className="col-md-4 mb-0">
                    <Label for={`group-description-${group.id}`}>Description</Label>
                    <Input id={`group-description-${group.id}`} name={`description-${group.id}`} type="textarea" value={draft.description} onChange={(event) => updateDraft(group.id, 'description', event.target.value)} />
                  </FormGroup>
                  <div className="col-md-4 d-flex flex-wrap gap-2">
                    <Button type="submit" data-action="update-group" disabled={pending || !draft.name.trim()}>Save changes</Button>
                    <Button type="button" color="outline-secondary" aria-label={`Manage members of ${group.name}`} disabled={pending} onClick={() => setMembersGroupId(membersGroupId === group.id ? null : group.id)}>
                      {membersGroupId === group.id ? 'Hide members' : 'Members'}
                    </Button>
                    <Button type="button" color="outline-danger" aria-label={`Delete ${group.name}`} disabled={pending} onClick={() => handleDelete(group)}>Delete</Button>
                  </div>
                </Form>
                {membersGroupId === group.id && <GroupMembers group={group} />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdminGroups;

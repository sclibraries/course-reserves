import { useEffect, useState } from 'react';
import { Button } from '../../../ui/button';
import { Label } from '../../../ui/label';
import NativeSelect from '../../../ui/native-select';
import { staffGroupsApi } from '../../../../services/admin/staffGroupsApi';
import {
  ACCESS_PATHS,
  ACCESS_PATH_LABELS,
  getAccessPathRoutingErrorMessage,
} from '../../../../services/admin/workflowFlows/accessPathFormatters';
import { workflowFlowsApi } from '../../../../services/admin/workflowFlows/workflowFlowsApi';

const emptyMapping = () => ACCESS_PATHS.map((access_path) => ({ access_path, flow_id: null, group_id: null }));

function AccessPathRoutingTab() {
  const [mapping, setMapping] = useState(emptyMapping);
  const [flows, setFlows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      workflowFlowsApi.getAccessPathMapping(),
      workflowFlowsApi.getAdminFlows(),
      staffGroupsApi.getAllGroups(),
    ]).then(([routes, flowOptions, groupOptions]) => {
      if (!active) return;
      setMapping(routes.mapping || emptyMapping());
      setFlows(flowOptions.flows || []);
      setGroups(groupOptions.groups || []);
    }).catch(() => {
      if (active) {
        setLoadFailed(true);
        setError('Access path routing could not be loaded. Check the connection, then reload this tab.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const updateRoute = (accessPath, field, value) => {
    setMapping((current) => current.map((route) => (
      route.access_path === accessPath
        ? { ...route, [field]: value === '' ? null : Number(value) }
        : route
    )));
    setError('');
    setNotice('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await workflowFlowsApi.putAccessPathMapping({ mapping });
      setMapping(result.mapping || mapping);
      setNotice('Access path routing saved.');
    } catch (requestError) {
      setError(getAccessPathRoutingErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Access path routing" className="tw-min-w-0 tw-space-y-4">
      <header className="tw-min-w-0 tw-space-y-1">
        <h1 className="tw-break-words tw-text-2xl tw-font-semibold">Access path routing</h1>
        <p className="tw-text-sm tw-text-muted-foreground">Choose the workflow and staff group for each access path.</p>
      </header>
      {loading && <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading access path routes...</p>}
      {error && <p id="access-path-routing-error" className="tw-break-words tw-text-sm tw-text-destructive" role="alert">{error}</p>}
      {notice && <p className="tw-text-sm" role="status">{notice}</p>}
      <form onSubmit={save} className="tw-min-w-0 tw-space-y-4">
        <div className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-3 md:tw-grid-cols-2">
          {mapping.map((route) => {
            const pathLabel = ACCESS_PATH_LABELS[route.access_path];
            return (
              <fieldset key={route.access_path} className="tw-min-w-0 tw-space-y-3 tw-rounded-md tw-border tw-p-3">
                <legend className="tw-px-1 tw-font-semibold">{pathLabel}</legend>
                <div className="tw-min-w-0 tw-space-y-2">
                  <Label htmlFor={`routing-flow-${route.access_path}`}>Flow for {pathLabel}</Label>
                  <NativeSelect
                    id={`routing-flow-${route.access_path}`}
                    value={route.flow_id ?? ''}
                    aria-describedby={error ? 'access-path-routing-error' : undefined}
                    disabled={loading || saving}
                    onChange={(event) => updateRoute(route.access_path, 'flow_id', event.target.value)}
                  >
                    <option value="">None</option>
                    {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
                  </NativeSelect>
                </div>
                <div className="tw-min-w-0 tw-space-y-2">
                  <Label htmlFor={`routing-group-${route.access_path}`}>Group for {pathLabel}</Label>
                  <NativeSelect
                    id={`routing-group-${route.access_path}`}
                    value={route.group_id ?? ''}
                    aria-describedby={error ? 'access-path-routing-error' : undefined}
                    disabled={loading || saving}
                    onChange={(event) => updateRoute(route.access_path, 'group_id', event.target.value)}
                  >
                    <option value="">None</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </NativeSelect>
                </div>
              </fieldset>
            );
          })}
        </div>
        <Button type="submit" disabled={loading || saving || loadFailed}>
          {saving ? 'Saving…' : 'Save routing'}
        </Button>
      </form>
    </section>
  );
}

export default AccessPathRoutingTab;

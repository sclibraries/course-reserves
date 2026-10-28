import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import NativeSelect from '../../../../ui/native-select';
import { staffGroupsApi } from '../../../../../services/admin/staffGroupsApi';
import { getAccessPathErrorMessage, getAccessPathNotice, ACCESS_PATH_LABELS } from '../../../../../services/admin/workflowFlows/accessPathFormatters';
import { workflowFlowsApi } from '../../../../../services/admin/workflowFlows/workflowFlowsApi';
import { getReadinessStatus } from '../submissionPageUtils';
import RequiredReasonForm from '../RequiredReasonForm';

function AccessPathSection({ item, canSetPath, flow, onChanged }) {
  const [accessPath, setAccessPath] = useState(item.accessPath || '');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const showSection = getReadinessStatus(item) === 'missing' || Boolean(item.accessPath);
  const pathChanged = Boolean(item.accessPath && accessPath !== item.accessPath);
  const selectId = `access-path-${item.kind}-${item.id}`;
  const describedBy = error ? `${selectId}-error` : undefined;

  useEffect(() => setAccessPath(item.accessPath || ''), [item.kind, item.id, item.accessPath]);

  if (!showSection) return null;

  const savePath = async (reason) => {
    if (!canSetPath || !accessPath || saving) return false;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await workflowFlowsApi.setAccessPath(item.kind, item.id, {
        access_path: accessPath,
        ...(reason ? { reason } : {}),
      });
      setAccessPath(result.access_path);
      await onChanged?.();

      let flowState = null;
      let groups = [];
      try {
        const [nextFlow, groupResult] = await Promise.all([
          workflowFlowsApi.getItemFlow(item.kind, item.id),
          result.group_id ? staffGroupsApi.getGroupsForHandoff() : Promise.resolve(null),
        ]);
        flowState = nextFlow;
        groups = groupResult?.groups || [];
        flow.replaceFlowState(nextFlow);
      } catch {
        setNotice('Access path set. Destination details could not be loaded.');
        return true;
      }
      setNotice(getAccessPathNotice(result, flowState, groups));
      return true;
    } catch (requestError) {
      setError(getAccessPathErrorMessage(requestError));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (pathChanged) setReasonOpen(true);
    else savePath();
  };

  return (
    <section aria-label="Access path" className="tw-min-w-0 tw-space-y-3">
      <h3 className="tw-text-base tw-font-semibold">How will we get it?</h3>
      {item.accessPath && <p className="tw-text-sm">Current path: {ACCESS_PATH_LABELS[item.accessPath] || item.accessPath}</p>}
      {canSetPath && (
        <>
          <div className="tw-flex tw-min-w-0 tw-flex-col tw-gap-2 sm:tw-flex-row sm:tw-items-end">
            <div className="tw-min-w-0 tw-flex-1 tw-space-y-2">
              <Label htmlFor={selectId}>Access path</Label>
              <NativeSelect
                id={selectId}
                value={accessPath}
                aria-describedby={describedBy}
                disabled={saving || reasonOpen}
                onChange={(event) => { setAccessPath(event.target.value); setNotice(''); setError(''); }}
              >
                <option value="">Choose an access path</option>
                {(item.allowedAccessPaths || []).map((path) => (
                  <option key={path} value={path}>{ACCESS_PATH_LABELS[path] || path}</option>
                ))}
              </NativeSelect>
            </div>
            {!reasonOpen && (
              <Button
                type="button"
                disabled={!accessPath || accessPath === item.accessPath || saving}
                onClick={handleSave}
              >
                Save access path
              </Button>
            )}
          </div>
          {!reasonOpen && error && <p id={`${selectId}-error`} className="tw-text-sm tw-text-destructive" role="alert">{error}</p>}
          {notice && <p className="tw-break-words tw-text-sm" role="status">{notice}</p>}
          {reasonOpen && (
            <RequiredReasonForm
              open
              onCancel={() => { setReasonOpen(false); setError(''); }}
              onSuccess={() => setReasonOpen(false)}
              onConfirm={savePath}
              saving={saving}
              reasonId={`access-path-reason-${item.kind}-${item.id}`}
              reasonLabel="Reason for changing access path (required)"
              error={error}
              submitLabel="Save access path"
            />
          )}
        </>
      )}
    </section>
  );
}

AccessPathSection.propTypes = {
  item: PropTypes.object.isRequired,
  canSetPath: PropTypes.bool.isRequired,
  flow: PropTypes.object.isRequired,
  onChanged: PropTypes.func,
};

export default AccessPathSection;

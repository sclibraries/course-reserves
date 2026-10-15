import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Badge,
  Button,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
} from 'reactstrap';
import { toast } from 'react-toastify';
import { formatLocalDate } from '../../../../util/dateBoundaries';
import { facultyProxyService } from '../../../../services/admin/facultyProxyService';
import ProxyActivityLog from './ProxyActivityLog';

const scopeLabel = (grant) => grant.scope_summary || ({
  full_access: 'Edit all courses',
  specific_courses: 'Edit selected courses',
  view_only: 'View all courses',
}[grant.permission_type] || grant.permission_type || 'Unknown scope');

const dateLabel = (value) => formatLocalDate(value) || '—';

function GrantRows({ grants, onRevoke }) {
  return grants.map((grant) => (
    <tr key={grant.permission_id}>
      <td>
        <strong>{grant.faculty_display_name || 'Unknown faculty'}</strong>
        <div className="small text-muted">{grant.faculty_id}</div>
      </td>
      <td>
        <strong>{grant.proxy_display_name || 'Unknown designee'}</strong>
        <div className="small text-muted">{grant.proxy_email}</div>
      </td>
      <td>
        {scopeLabel(grant)}
        {grant.courses?.length > 0 && (
          <ul className="mb-0 ps-3">
            {grant.courses.map((course) => (
              <li key={course.folio_course_listing_id}>
                {course.course_title || course.folio_course_listing_id}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td><Badge color={grant.status === 'active' ? 'success' : 'secondary'}>{grant.status}</Badge></td>
      <td>{dateLabel(grant.invited_at)}</td>
      <td>{dateLabel(grant.accepted_at)}</td>
      <td>{dateLabel(grant.expires_at || grant.invitation_expires_at)}</td>
      <td>
        {grant.status !== 'revoked' && (
          <Button
            color="danger"
            outline
            size="sm"
            aria-label={`Revoke grant ${grant.permission_id}`}
            onClick={() => onRevoke(grant)}
          >
            Revoke
          </Button>
        )}
      </td>
    </tr>
  ));
}

GrantRows.propTypes = {
  grants: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRevoke: PropTypes.func.isRequired,
};

export default function FacultyProxyAccess() {
  const [status, setStatus] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [grants, setGrants] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grantToRevoke, setGrantToRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [grantResponse, activityResponse] = await Promise.all([
        facultyProxyService.listGrants({ status, facultyId }),
        facultyProxyService.getActivityLog({ facultyId }),
      ]);
      setGrants(grantResponse.items || []);
      setActivity(activityResponse.items || []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load faculty proxy access.');
    } finally {
      setLoading(false);
    }
  }, [status, facultyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmRevoke = async () => {
    if (!grantToRevoke) return;
    setRevoking(true);
    try {
      const result = await facultyProxyService.revokeGrant(grantToRevoke.permission_id);
      toast.success(result.message || 'Proxy access revoked');
      setGrantToRevoke(null);
      await loadData();
    } catch (revokeError) {
      toast.error(revokeError.message || 'Unable to revoke proxy access.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="faculty-proxy-access">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h3 mb-1">Faculty proxy access</h1>
          <p className="text-muted mb-0">Review grants, activity, and revoke access when needed.</p>
        </div>
        <Button color="secondary" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="row g-3 mb-3">
        <FormGroup className="col-sm-4">
          <Label for="proxy-status-filter">Status</Label>
          <Input
            id="proxy-status-filter"
            aria-label="Grant status filter"
            type="select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </Input>
        </FormGroup>
        <FormGroup className="col-sm-4">
          <Label for="proxy-faculty-filter">Faculty ID</Label>
          <Input
            id="proxy-faculty-filter"
            aria-label="Faculty ID filter"
            value={facultyId}
            onChange={(event) => setFacultyId(event.target.value)}
            placeholder="Filter by faculty ID"
          />
        </FormGroup>
      </div>

      {error && (
        <Alert color="danger" className="d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <Button color="danger" outline size="sm" onClick={loadData}>Try again</Button>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5" role="status">
          <Spinner color="primary" />
          <p className="mt-2 text-muted">Loading faculty proxy access...</p>
        </div>
      ) : !error && grants.length === 0 ? (
        <Alert color="info">No proxy grants found.</Alert>
      ) : !error && (
        <div className="table-responsive">
          <Table hover responsive>
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Designee</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Invited</th>
                <th>Accepted</th>
                <th>Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody><GrantRows grants={grants} onRevoke={setGrantToRevoke} /></tbody>
          </Table>
        </div>
      )}

      {!loading && !error && <ProxyActivityLog entries={activity} />}

      <Modal isOpen={Boolean(grantToRevoke)} toggle={() => setGrantToRevoke(null)} fade={false}>
        <ModalHeader toggle={() => setGrantToRevoke(null)}>Revoke faculty proxy access?</ModalHeader>
        <ModalBody>
          Revoke {grantToRevoke?.proxy_display_name || 'this designee'}’s access for{' '}
          {grantToRevoke?.faculty_display_name || 'this faculty member'}?
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setGrantToRevoke(null)} disabled={revoking}>
            Cancel
          </Button>
          <Button color="danger" onClick={confirmRevoke} disabled={revoking}>
            {revoking ? 'Revoking…' : 'Revoke access'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

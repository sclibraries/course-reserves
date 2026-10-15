import PropTypes from 'prop-types';
import { Alert, Table } from 'reactstrap';

const getActor = (entry) => {
  const details = entry.details || {};
  const actorId = details.invited_by_user_id
    || details.accepted_by_user_id
    || details.revoked_by_user_id
    || entry.proxy_shibboleth_id;
  const actorRole = details.invited_by_role
    || details.accepted_by_role
    || details.revoked_by_role;

  return [actorId, actorRole].filter(Boolean).join(' · ') || 'Unknown actor';
};

const formatDetails = (details) => {
  if (!details || Object.keys(details).length === 0) return '—';

  return Object.entries(details).map(([key, value]) => (
    <div key={key}>
      <strong>{key.replaceAll('_', ' ')}:</strong> {String(value)}
    </div>
  ));
};

export default function ProxyActivityLog({ entries }) {
  return (
    <section aria-labelledby="proxy-activity-heading" className="mt-4">
      <h2 id="proxy-activity-heading" className="h5">Activity log</h2>
      {entries.length === 0 ? (
        <Alert color="info">No proxy activity found.</Alert>
      ) : (
        <div className="table-responsive">
          <Table hover responsive>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Faculty</th>
                <th>Designee</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.log_id}>
                  <td><time dateTime={entry.created_at}>{entry.created_at || '—'}</time></td>
                  <td>{(entry.action || 'unknown').replaceAll('_', ' ')}</td>
                  <td>{entry.faculty_shibboleth_id}</td>
                  <td>{entry.proxy_shibboleth_id}</td>
                  <td>{getActor(entry)}</td>
                  <td>{formatDetails(entry.details)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}

ProxyActivityLog.propTypes = {
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
};

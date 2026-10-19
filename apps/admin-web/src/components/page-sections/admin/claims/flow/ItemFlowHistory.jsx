import PropTypes from 'prop-types';

function ItemFlowHistory({ history }) {
  return (
    <section aria-label="Item flow history" className="mt-3">
      <h4 className="h6">Item flow history</h4>
      {!history.length && <p className="text-muted mb-0">No item flow history yet.</p>}
      <ol className="list-unstyled mb-0">
        {history.map((entry, index) => (
          <li className="border-top py-2" key={`${entry.created_at}-${entry.step_key}-${index}`}>
            <strong>{entry.step_label}</strong>{entry.outcome_label && ` · ${entry.outcome_label}`}
            {entry.notes && <p className="mb-0">Notes: {entry.notes}</p>}
            {entry.reason && <p className="mb-0">Reason: {entry.reason}</p>}
            <p className="small text-muted mb-0">
              {entry.actor_display || 'Staff member'} · {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Time unavailable'}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

ItemFlowHistory.propTypes = { history: PropTypes.arrayOf(PropTypes.object).isRequired };

export default ItemFlowHistory;

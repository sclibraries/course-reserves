import PropTypes from 'prop-types';

function ItemFlowHistory({ history }) {
  return (
    <section aria-label="Item flow history" className="tw-min-w-0">
      <h3 className="tw-text-base tw-font-semibold">Item flow history</h3>
      {!history.length && <p className="tw-mt-3 tw-text-sm tw-text-muted-foreground">No item flow history yet.</p>}
      <ol className="tw-mt-2 tw-divide-y">
        {history.map((entry, index) => (
          <li className="tw-min-w-0 tw-py-3" key={`${entry.created_at}-${entry.step_key}-${index}`}>
            <p className="tw-break-words tw-text-sm">
              <strong>{entry.step_label || 'Step update'}</strong>{entry.outcome_label && ` · ${entry.outcome_label}`}
            </p>
            {entry.notes && <p className="tw-mt-1 tw-break-words tw-text-sm">Notes: {entry.notes}</p>}
            {entry.reason && <p className="tw-mt-1 tw-break-words tw-text-sm">Reason: {entry.reason}</p>}
            <p className="tw-mt-1 tw-text-xs tw-text-muted-foreground">
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

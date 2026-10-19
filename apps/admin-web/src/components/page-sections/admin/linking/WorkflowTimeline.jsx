import PropTypes from 'prop-types';

const readableEvent = (eventType = '') => eventType.replace(/_/g, ' ');

function WorkflowTimeline({ events, error = '', title = 'Workflow timeline', id = 'workflow-timeline-title' }) {
  return (
    <section className="workflow-timeline" aria-labelledby={id}>
      <h3 id={id} className="h5">{title}</h3>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {!error && events.length === 0 && <p className="text-muted">No workflow events recorded yet.</p>}
      <ol className="list-unstyled mb-0">
        {events.map((event, index) => (
          <li className="workflow-timeline-event" key={`${event.created_at}-${event.event_type}-${index}`}>
            <div className="d-flex justify-content-between gap-3">
              <strong className="text-capitalize">{readableEvent(event.event_type)}</strong>
              <time dateTime={event.created_at}>{event.created_at ? new Date(event.created_at).toLocaleString() : 'Time unavailable'}</time>
            </div>
            <div>{event.actor || 'Staff member'}{event.actor_role ? ` (${event.actor_role})` : ''}</div>
            {event.reason && <p className="mb-1">{event.reason}</p>}
            {(event.before || event.after) && (
              <details>
                <summary>Change details</summary>
                <pre>{JSON.stringify({ before: event.before, after: event.after }, null, 2)}</pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

WorkflowTimeline.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
  error: PropTypes.string,
  title: PropTypes.string,
  id: PropTypes.string,
};

export default WorkflowTimeline;

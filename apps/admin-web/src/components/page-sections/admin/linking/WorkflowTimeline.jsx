import PropTypes from 'prop-types';

const readableEvent = (eventType = '') => eventType.replace(/_/g, ' ');

function WorkflowTimeline({ events, error = '', title = 'Workflow timeline', id = 'workflow-timeline-title' }) {
  return (
    <section className="tw-min-w-0" aria-labelledby={id}>
      <h3 id={id} className="tw-text-lg tw-font-semibold">{title}</h3>
      {error && <p role="alert" className="tw-mt-3 tw-text-sm tw-text-destructive">{error}</p>}
      {!error && events.length === 0 && <p className="tw-mt-3 tw-text-sm tw-text-muted-foreground">No workflow events recorded yet.</p>}
      <ol className="tw-mt-4 tw-space-y-4">
        {events.map((event, index) => (
          <li className="tw-min-w-0 tw-border-l-2 tw-pl-4" key={`${event.created_at}-${event.event_type}-${index}`}>
            <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-justify-between tw-gap-x-3 tw-gap-y-1">
              <strong className="tw-capitalize">{readableEvent(event.event_type)}</strong>
              <time className="tw-text-sm tw-text-muted-foreground" dateTime={event.created_at}>
                {event.created_at ? new Date(event.created_at).toLocaleString() : 'Time unavailable'}
              </time>
            </div>
            <div className="tw-mt-1 tw-break-words tw-text-sm">{event.actor || 'Staff member'}{event.actor_role ? ` (${event.actor_role})` : ''}</div>
            {event.reason && <p className="tw-mt-2 tw-break-words tw-text-sm">{event.reason}</p>}
            {(event.before || event.after) && (
              <details className="tw-mt-2 tw-text-sm">
                <summary className="tw-cursor-pointer tw-underline">Change details</summary>
                <pre className="tw-mt-2 tw-overflow-x-auto tw-whitespace-pre-wrap tw-break-words tw-rounded tw-bg-muted tw-p-2">
                  {JSON.stringify({ before: event.before, after: event.after }, null, 2)}
                </pre>
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

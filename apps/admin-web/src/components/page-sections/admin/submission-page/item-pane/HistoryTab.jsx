import PropTypes from 'prop-types';
import WorkflowTimeline from '../../linking/WorkflowTimeline';
import ItemFlowHistory from './ItemFlowHistory';

function HistoryTab({ flowHistory, timeline }) {
  return (
    <div className="tw-min-w-0 tw-space-y-6">
      <ItemFlowHistory history={flowHistory} />
      {timeline.loading && <p className="tw-text-sm tw-text-muted-foreground" role="status">Loading item timeline...</p>}
      {!timeline.loading && (
        <WorkflowTimeline
          events={timeline.events}
          error={timeline.error}
          title={`Item timeline: ${timeline.title}`}
          id={`item-timeline-${timeline.kind}-${timeline.itemId}`}
        />
      )}
    </div>
  );
}

HistoryTab.propTypes = {
  flowHistory: PropTypes.arrayOf(PropTypes.object).isRequired,
  timeline: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    events: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    kind: PropTypes.string.isRequired,
    itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
};

export default HistoryTab;

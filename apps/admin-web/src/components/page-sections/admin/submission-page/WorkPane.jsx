import PropTypes from 'prop-types';
import { Button } from '../../../ui/button';

function WorkPane({ isLinked, selectedItem, children, unlinkedContent, onBack }) {
  return (
    <section className="tw-min-w-0 tw-space-y-3 tw-break-words" aria-label="Work pane" data-testid="submission-work-pane">
      {isLinked ? (
        <>
          <Button type="button" variant="ghost" className="tw-h-9 tw-px-2 lg:tw-hidden" onClick={onBack}>
            Back to list
          </Button>
          {selectedItem ? children : <p className="tw-text-sm tw-text-muted-foreground">Select an item to see its work pane.</p>}
        </>
      ) : (
        <div className="tw-min-w-0 tw-rounded-lg tw-border tw-bg-card tw-p-3 sm:tw-p-4">
          {unlinkedContent}
        </div>
      )}
    </section>
  );
}

WorkPane.propTypes = {
  isLinked: PropTypes.bool.isRequired,
  selectedItem: PropTypes.object,
  children: PropTypes.node,
  unlinkedContent: PropTypes.node,
  onBack: PropTypes.func.isRequired,
};

export default WorkPane;

import PropTypes from 'prop-types';
import { Button } from '../../../ui/button';

function WorkPane({ isLinked, selectedItem, children, unlinkedContent, onBack }) {
  return (
    <section className="tw-min-w-0 tw-break-words tw-rounded-lg tw-border tw-bg-card tw-p-4" aria-label="Work pane" data-testid="submission-work-pane">
      {isLinked ? (
        <>
          <Button variant="ghost" className="tw-mb-3 lg:tw-hidden" onClick={onBack}>
            Back to list
          </Button>
          {selectedItem ? children : <p className="tw-text-sm tw-text-muted-foreground">Select an item to see its work pane.</p>}
        </>
      ) : (
        unlinkedContent
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

import PropTypes from 'prop-types';
import { Button } from '../../../ui/button';
import { getClaimBadge, getReadinessPresentation } from './submissionPageUtils';
import ReadinessStatusIcon from './ReadinessStatusIcon';

function SubmissionItemRow({ item, currentUser, selected, disabled, onSelect }) {
  const readiness = getReadinessPresentation(item);
  const claim = getClaimBadge(item, currentUser);
  const title = item.title || 'Untitled item';
  const claimTitle = item.claimed_by_display || item.claimed_by || claim.label;

  return (
    <div
      className={`tw-flex tw-min-w-0 tw-items-start tw-gap-2 tw-rounded-md tw-border tw-p-1 ${selected ? 'tw-border-primary tw-bg-accent' : 'tw-border-transparent'}`}
      data-item-row={item.id}
    >
      <span className="tw-pt-2"><ReadinessStatusIcon presentation={readiness} /></span>
      <Button
        type="button"
        variant="ghost"
        className="tw-h-auto tw-min-w-0 tw-flex-1 tw-justify-start tw-whitespace-normal tw-p-1.5 tw-text-left"
        aria-pressed={selected}
        aria-current={selected ? 'true' : undefined}
        aria-label={`Select ${title}`}
        aria-description={`Readiness: ${readiness.label}${item.readinessReason ? `. ${item.readinessReason}` : ''}. Claim: ${claim.label}.`}
        data-item-select={item.id}
        disabled={disabled}
        onClick={() => onSelect(item)}
      >
        <span className="tw-min-w-0 tw-flex-1">
          <span data-row-title className="tw-line-clamp-3 tw-break-words tw-font-medium" title={title}>{title}</span>
          <span
            data-row-claim
            className="tw-mt-0.5 tw-block tw-min-w-0 tw-truncate tw-text-xs tw-text-muted-foreground"
            title={claimTitle}
          >
            <span className="tw-sr-only">Claim: </span>{claim.label}
          </span>
        </span>
      </Button>
    </div>
  );
}

SubmissionItemRow.propTypes = {
  item: PropTypes.object.isRequired,
  currentUser: PropTypes.object,
  selected: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

export default SubmissionItemRow;

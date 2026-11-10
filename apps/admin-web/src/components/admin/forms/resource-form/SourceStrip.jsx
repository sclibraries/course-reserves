import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';
import { Button } from '../../../ui/button';

const FIELD_LABELS = {
  link: 'Primary link',
  material_type_id: 'Material type',
  notes: 'Description',
};

const labelForField = (field) => FIELD_LABELS[field]
  || field.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());

export const SourceStrip = ({ source, canChangeRecord = false, onChangeRecord, keptFields = [] }) => (
  <section
    aria-label="Resource source"
    className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-2 tw-rounded-md tw-border tw-bg-muted tw-px-3 tw-py-2 tw-text-sm"
  >
    <div className="tw-min-w-0 tw-flex-1">
      <details className="tw-min-w-0 md:tw-hidden">
        <summary className="tw-flex tw-cursor-pointer tw-list-none tw-items-center tw-justify-between tw-gap-2 tw-rounded-sm focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring">
          <span className="tw-break-words">{source.summary}</span>
          <ChevronDown aria-hidden="true" className="tw-size-4 tw-shrink-0" />
        </summary>
        <p className="tw-mt-2 tw-break-words tw-text-muted-foreground">{source.text}</p>
      </details>
      <p className="tw-hidden tw-break-words tw-text-muted-foreground md:tw-block">{source.text}</p>
    </div>
    {canChangeRecord && (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Change record"
        onClick={onChangeRecord}
      >
        Change record
      </Button>
    )}
    {keptFields.length > 0 && (
      <p role="status" className="tw-basis-full tw-break-words tw-text-muted-foreground">
        Kept your edits: {keptFields.map(labelForField).join(', ')}
      </p>
    )}
  </section>
);

SourceStrip.propTypes = {
  source: PropTypes.shape({
    summary: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
  }).isRequired,
  canChangeRecord: PropTypes.bool,
  onChangeRecord: PropTypes.func,
  keptFields: PropTypes.arrayOf(PropTypes.string),
};

export default SourceStrip;

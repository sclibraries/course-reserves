import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

export const SourceStrip = ({ source }) => (
  <section
    aria-label="Resource source"
    className="tw-min-w-0 tw-rounded-md tw-border tw-bg-muted tw-px-3 tw-py-2 tw-text-sm"
  >
    <details className="tw-min-w-0 md:tw-hidden">
      <summary className="tw-flex tw-cursor-pointer tw-list-none tw-items-center tw-justify-between tw-gap-2 tw-rounded-sm focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring">
        <span className="tw-break-words">{source.summary}</span>
        <ChevronDown aria-hidden="true" className="tw-size-4 tw-shrink-0" />
      </summary>
      <p className="tw-mt-2 tw-break-words tw-text-muted-foreground">{source.text}</p>
    </details>
    <p className="tw-hidden tw-break-words tw-text-muted-foreground md:tw-block">{source.text}</p>
  </section>
);

SourceStrip.propTypes = {
  source: PropTypes.shape({
    summary: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
  }).isRequired,
};

export default SourceStrip;

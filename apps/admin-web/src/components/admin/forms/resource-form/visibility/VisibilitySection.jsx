import PropTypes from 'prop-types';
import { CalendarClock } from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { normalizeVisibilityFlag } from '../../../../../hooks/admin/useVisibilityFormState';
import { ResourceFormSection } from '../ResourceFormSection';
import { DatePairControl } from './DatePairControl';
import { VisibilitySummary } from './VisibilitySummary';

export const VisibilitySection = ({
  formData,
  mode = 'course',
  useVisibilityDates,
  onResourceVisibilityToggle,
  onItemDateChange,
  onPrimaryLinkVisibilityToggle,
  onPrimaryLinkDateChange,
  summary,
  links,
  onLinkVisibilityChange,
  onLinkDateChange,
}) => (
  <ResourceFormSection id="when-can-students-see-it" title="When can students see it?" icon={CalendarClock}>
    {mode !== 'none' && (
      <>
        <h4 className="tw-font-medium">This course</h4>
        <div className="tw-min-w-0 tw-space-y-3">
          <div className="tw-flex tw-min-h-6 tw-items-center tw-gap-2">
            <Input
              id="item-visibility-enabled"
              type="checkbox"
              checked={useVisibilityDates}
              onChange={(event) => onResourceVisibilityToggle(event.target.checked)}
              className="tw-size-6 tw-shrink-0 tw-p-0"
            />
            <Label htmlFor="item-visibility-enabled">Show this item between</Label>
          </div>
          <p className="tw-text-sm tw-text-muted-foreground">Outside these dates students don&apos;t see this item.</p>
          {useVisibilityDates && (
            <DatePairControl
              id="item-visibility"
              startLabel="Item start date"
              endLabel="Item end date"
              startName="start_visibility"
              endName="end_visibility"
              startValue={formData.start_visibility}
              endValue={formData.end_visibility}
              onStartChange={onItemDateChange}
              onEndChange={onItemDateChange}
            />
          )}
        </div>
        {formData.link && (
          <div className="tw-min-w-0 tw-space-y-3 tw-border-t tw-pt-4">
            <div className="tw-flex tw-min-h-6 tw-items-center tw-gap-2">
              <Input
                id="primary-link-visibility-enabled"
                type="checkbox"
                checked={normalizeVisibilityFlag(formData.use_primary_link_visibility)}
                onChange={(event) => onPrimaryLinkVisibilityToggle(event.target.checked)}
                className="tw-size-6 tw-shrink-0 tw-p-0"
              />
              <Label htmlFor="primary-link-visibility-enabled">Primary link only between</Label>
            </div>
            {normalizeVisibilityFlag(formData.use_primary_link_visibility) && (
              <DatePairControl
                id="primary-link-visibility"
                startLabel="Primary link start date"
                endLabel="Primary link end date"
                startName="primary_link_start_visibility"
                endName="primary_link_end_visibility"
                startValue={formData.primary_link_start_visibility}
                endValue={formData.primary_link_end_visibility}
                onStartChange={onPrimaryLinkDateChange}
                onEndChange={onPrimaryLinkDateChange}
              />
            )}
          </div>
        )}
      </>
    )}
    {links.length > 0 && <h4 className="tw-font-medium">All courses</h4>}
    {links.map((link, index) => (
      <div key={index} className="tw-min-w-0 tw-space-y-3 tw-border-t tw-pt-4">
        <div className="tw-flex tw-min-h-6 tw-items-center tw-gap-2">
          <Input
            id={`link-visibility-enabled-${index}`}
            type="checkbox"
            checked={normalizeVisibilityFlag(link.use_link_visibility)}
            onChange={(event) => onLinkVisibilityChange(index, event.target.checked)}
            className="tw-size-6 tw-shrink-0 tw-p-0"
          />
          <Label htmlFor={`link-visibility-enabled-${index}`}>Link {index + 1} only between</Label>
        </div>
        <p className="tw-text-sm tw-text-muted-foreground">Applies in every course using this resource.</p>
        {normalizeVisibilityFlag(link.use_link_visibility) && (
          <DatePairControl
            id={`link-${index}-visibility`}
            startLabel={`Link ${index + 1} start date`}
            endLabel={`Link ${index + 1} end date`}
            startName="start_visibility"
            endName="end_visibility"
            startValue={link.start_visibility}
            endValue={link.end_visibility}
            onStartChange={(event) => onLinkDateChange(index, 'start_visibility', event.target.value)}
            onEndChange={(event) => onLinkDateChange(index, 'end_visibility', event.target.value)}
          />
        )}
      </div>
    ))}
    <VisibilitySummary summary={summary} />
  </ResourceFormSection>
);

VisibilitySection.propTypes = {
  formData: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(['course', 'none']),
  useVisibilityDates: PropTypes.bool.isRequired,
  onResourceVisibilityToggle: PropTypes.func.isRequired,
  onItemDateChange: PropTypes.func.isRequired,
  onPrimaryLinkVisibilityToggle: PropTypes.func.isRequired,
  onPrimaryLinkDateChange: PropTypes.func.isRequired,
  summary: PropTypes.shape({
    citation: PropTypes.string,
    primaryLink: PropTypes.string,
    links: PropTypes.arrayOf(PropTypes.object).isRequired,
    sharedDatesMessage: PropTypes.string,
  }).isRequired,
  links: PropTypes.arrayOf(PropTypes.object).isRequired,
  onLinkVisibilityChange: PropTypes.func.isRequired,
  onLinkDateChange: PropTypes.func.isRequired,
};

export default VisibilitySection;

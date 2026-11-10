import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../ui/card';
import { FieldMarker } from './FieldMarker';

const displayValue = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return Array.isArray(value) ? value.join('; ') : String(value ?? '');
};

export const OtherDetails = ({ metadata = {}, materialTypeFields = [], markerFor, materialTypeId }) => {
  const activeFields = new Set(materialTypeFields.map(({ field_name: name }) => name));
  const fields = Object.entries(metadata).filter(([name]) => name !== 'accession_number' && !activeFields.has(name));
  if (!fields.length) return null;

  return (
    <section aria-labelledby="other-details-title" className="tw-min-w-0">
      <Card className="tw-min-w-0">
        <CardHeader className="tw-p-4 tw-pb-2">
          <h4 id="other-details-title" className="tw-font-medium">Other details</h4>
        </CardHeader>
        <CardContent className="tw-p-4 tw-pt-0">
          <dl className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-3 md:tw-grid-cols-2">
            {fields.map(([name, value]) => (
              <div key={name} className="tw-min-w-0 tw-break-words">
                <dt className="tw-font-medium">
                  {name.replace(/_/g, ' ')}
                  <FieldMarker marker={markerFor?.(name, value, materialTypeId)} />
                </dt>
                <dd className="tw-break-words tw-text-muted-foreground">{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
};

OtherDetails.propTypes = {
  metadata: PropTypes.object,
  materialTypeFields: PropTypes.arrayOf(PropTypes.shape({ field_name: PropTypes.string })),
  markerFor: PropTypes.func,
  materialTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default OtherDetails;

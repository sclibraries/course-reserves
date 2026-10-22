import PropTypes from 'prop-types';
import { getHttpUrl } from './itemPaneUtils';

function DetailsTab({ item }) {
  const url = getHttpUrl(item.url);
  const fields = [
    ['Author', item.authors],
    ['Publication year', item.publicationYear],
    ['Material type', item.material_type],
    ['Barcode', item.barcode],
    ['Call number', item.callNumber],
    ['DOI', item.doi],
    ['ISSN', item.issn],
    ['Journal', item.journalTitle],
    ['Volume', item.volume],
    ['Issue', item.issue],
    ['Resource URL', url ? <a className="tw-break-all tw-text-primary tw-underline" href={url} target="_blank" rel="noopener noreferrer">{url}</a> : item.url],
    ['Reuse', item.isReuse ? 'Yes' : null],
    ['Faculty notes', item.facultyNotes || 'None provided'],
    ['Staff notes', item.staffNotes || 'None provided'],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <section aria-label="Item details" className="tw-min-w-0">
      <h3 className="tw-text-base tw-font-semibold">Item details</h3>
      <dl className="tw-mt-3 tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-x-6 tw-gap-y-3 sm:tw-grid-cols-2">
        {fields.map(([label, value]) => (
          <div className="tw-min-w-0 tw-break-words" key={label}>
            <dt className="tw-text-sm tw-font-medium tw-text-muted-foreground">{label}</dt>
            <dd className="tw-mt-1 tw-break-words tw-text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

DetailsTab.propTypes = { item: PropTypes.object.isRequired };

export default DetailsTab;

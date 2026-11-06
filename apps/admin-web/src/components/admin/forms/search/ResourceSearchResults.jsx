import PropTypes from 'prop-types';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { ResourceFormType } from '../constants/formTypes';

function decodeHtmlEntities(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function getEdsTitle(record) {
  const titleData = record.Items?.Ti?.[0]?.CleanData;
  const title = (typeof titleData === 'string' ? titleData : titleData?.[0])
    || record.RecordInfo?.BibEntity?.Titles?.[0]?.TitleFull
    || '(No Title)';
  return decodeHtmlEntities(title);
}

function getEdsAuthors(record) {
  const authorData = record.Items?.Au?.[0]?.CleanData;
  const authors = Array.isArray(authorData) ? authorData : (typeof authorData === 'string' ? [authorData] : []);
  return decodeHtmlEntities(authors.join('; '));
}

function getEdsVerificationUrl(record) {
  if (!record.An) return record.PLink;
  return `https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:${encodeURIComponent(record.DbId)}:${encodeURIComponent(record.An)}`;
}

function EDSDetails({ record }) {
  const authors = getEdsAuthors(record);
  const verificationUrl = getEdsVerificationUrl(record);

  return (
    <>
      <dl className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-3 tw-text-sm sm:tw-grid-cols-2">
        <div className="tw-min-w-0">
          <dt className="tw-font-medium">Author</dt>
          <dd className="tw-break-words tw-text-muted-foreground">{authors || '—'}</dd>
        </div>
        <div className="tw-min-w-0">
          <dt className="tw-font-medium">Accession</dt>
          <dd className="tw-break-words tw-text-muted-foreground">{record.An || 'N/A'}</dd>
        </div>
        <div className="tw-min-w-0">
          <dt className="tw-font-medium">Type</dt>
          <dd><Badge variant="secondary">{record.pubType || 'Unknown'}</Badge></dd>
        </div>
        <div className="tw-min-w-0">
          <dt className="tw-font-medium">Database</dt>
          <dd className="tw-break-words tw-text-muted-foreground">{record.DbLabel || 'EBSCO'}</dd>
        </div>
      </dl>
      {verificationUrl && (
        <a
          className="tw-inline-flex tw-min-h-6 tw-items-center tw-gap-1 tw-text-sm tw-text-primary tw-underline"
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verify record <ExternalLink aria-hidden="true" className="tw-size-4" />
        </a>
      )}
    </>
  );
}

EDSDetails.propTypes = { record: PropTypes.object.isRequired };

function HitchcockDetails({ record }) {
  const link = record.link || record.item_url;

  return (
    <div className="tw-min-w-0 tw-space-y-2 tw-text-sm">
      <p className="tw-break-all">
        <span className="tw-font-medium">Link: </span>
        {link ? (
          <a className="tw-text-primary tw-underline" href={link} target="_blank" rel="noopener noreferrer">
            {link} <ExternalLink aria-hidden="true" className="tw-inline tw-size-4" />
          </a>
        ) : 'N/A'}
      </p>
      <p className="tw-break-words">
        <span className="tw-font-medium">Notes: </span>{record.notes || record.description || 'N/A'}
      </p>
    </div>
  );
}

HitchcockDetails.propTypes = { record: PropTypes.object.isRequired };

export default function ResourceSearchResults({ formType, results, onSelectRecord }) {
  const isEds = formType === ResourceFormType.EDS;

  return (
    <div className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-4 md:tw-grid-cols-2">
      {results.map((record) => {
        const title = isEds ? getEdsTitle(record) : (record.title || 'N/A');
        const key = record.An || record.id || record.PLink || title;
        return (
          <Card key={key} className="tw-min-w-0">
            <CardHeader className="tw-p-4">
              <CardTitle className="tw-min-w-0 tw-break-words tw-text-lg tw-leading-snug">{title}</CardTitle>
            </CardHeader>
            <CardContent className="tw-min-w-0 tw-space-y-4 tw-p-4 tw-pt-0">
              {isEds ? <EDSDetails record={record} /> : <HitchcockDetails record={record} />}
              <Button type="button" size="sm" onClick={() => onSelectRecord(record)}>
                Edit &amp; Add
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

ResourceSearchResults.propTypes = {
  formType: PropTypes.oneOf([ResourceFormType.EDS, ResourceFormType.HITCHCOCK]).isRequired,
  results: PropTypes.arrayOf(PropTypes.object).isRequired,
  onSelectRecord: PropTypes.func.isRequired,
};

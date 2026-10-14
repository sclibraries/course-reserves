import PropTypes from 'prop-types';
import React from 'react';
import { Table, Row, Col, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faBook, faLaptop } from '@fortawesome/free-solid-svg-icons';
import { containsHtml, sanitizeHtml } from '../../../../util/htmlUtils';
import {
  formatVisibilityDate,
  getVisibleLinks,
  isPrimaryLinkVisible,
} from '../../../../util/resourceVisibility';
import { formatPublicationEntries, getDiscoverUrl } from '../recordDisplayUtils';
import LinksExpandButton from './LinksExpandButton';

const formatPublication = (publication) => {
  if (!publication?.length) return 'N/A';
  return formatPublicationEntries(publication);
};

const RecordTableSplitView = ({ records, context }) => {
  const {
    accessibilityText,
    availability,
    canBypassVisibility,
    checkVisibility,
    customization,
    expandedLinkItems,
    handleExternalLinkClick,
    recordTableText,
    splitViewText,
    toggleLinksExpand,
  } = context;

  const visibleRecords = records.filter(item => checkVisibility(item).isVisible);
  const printRecords = visibleRecords.filter(item => !item.isElectronic);
  const electronicRecords = visibleRecords.filter(item => item.isElectronic);

  return (
    <Row>
      {/* Print resources column */}
      <Col md={6}>
        <div className="column-header mb-3 p-3 bg-light border rounded">
          <h3 className="h4 mb-0" style={{ color: customization.cardTextColor }}>
            <FontAwesomeIcon icon={faBook} className="text-muted me-2" />
            {splitViewText.printMaterials}
          </h3>
        </div>

        {printRecords.length === 0 ? (
          <p className="text-muted">{splitViewText.noPrintMaterials}</p>
        ) : (
          <Table bordered responsive className="align-middle">
            <thead className="table-light">
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Authors</th>
                <th scope="col">Publication</th>
                <th scope="col">Holdings</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {printRecords
                .sort((a, b) => a.copiedItem.title.localeCompare(b.copiedItem.title))
                .map(item => {
                  const instanceId = item.copiedItem?.instanceId;
                  const holdings = availability[instanceId]?.holdings || [];
                  const discoverUrl = getDiscoverUrl(customization?.recordsDiscoverLinkBaseUrl, instanceId);

                  return (
                    <tr key={item.id}>
                      <td>{item.copiedItem.title}</td>
                      <td>{item.copiedItem.contributors?.map(c => c.name).join(', ') || 'N/A'}</td>
                      <td>{formatPublication(item.copiedItem.publication)}</td>
                      <td>{holdings.length > 0 ? `${holdings.length} items` : 'N/A'}</td>
                      <td>
                        {discoverUrl ? (
                          <button
                            onClick={(e) =>
                              handleExternalLinkClick(e, 'record_discover_link', discoverUrl, item)
                            }
                            className="btn btn-sm btn-outline-secondary"
                          >
                            View in Catalog <FontAwesomeIcon icon={faExternalLinkAlt} />
                          </button>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        )}
      </Col>

      {/* Electronic resources column */}
      <Col md={6}>
        <div className="column-header mb-3 p-3 bg-light border rounded">
          <h3 className="h4 mb-0" style={{ color: customization.cardTextColor }}>
            <FontAwesomeIcon icon={faLaptop} className="text-muted me-2" />
            {splitViewText.electronicMaterials}
          </h3>
        </div>

        {electronicRecords.length === 0 ? (
          <p className="text-muted">{splitViewText.noElectronicMaterials}</p>
        ) : (
          <Table bordered responsive className="align-middle">
            <thead className="table-light">
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Description</th>
                <th scope="col">Access</th>
              </tr>
            </thead>
            <tbody>
              {electronicRecords
                .sort((a, b) => a.copiedItem.title.localeCompare(b.copiedItem.title))
                .map(item => {
                  const isPrimaryLinkVisibleCheck = isPrimaryLinkVisible(item.resource, canBypassVisibility);
                  const resourceUrl = item.resource?.item_url && isPrimaryLinkVisibleCheck ? item.resource.item_url : null;
                  const visibleAdditionalLinks = getVisibleLinks(item.resource?.links, canBypassVisibility);
                  const hasAdditionalLinks = visibleAdditionalLinks.length > 0;
                  const isExpanded = expandedLinkItems[item.id] || false;

                  return (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td>{item.copiedItem.title}</td>
                        <td>
                          {item.resource?.description ? (
                            <div className="small">
                              {containsHtml(item.resource.description) ? (
                                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.resource.description) }} />
                              ) : (
                                item.resource.description
                              )}
                            </div>
                          ) : 'N/A'}
                        </td>
                        <td>
                          {resourceUrl ? (
                            <div>
                              <button
                                onClick={(e) =>
                                  handleExternalLinkClick(e, 'resource_click', resourceUrl, item, {
                                    isElectronic: true,
                                  })
                                }
                                className="btn btn-sm btn-outline-secondary"
                                aria-label={accessibilityText.accessResourceGeneric}
                              >
                                {recordTableText.access} <FontAwesomeIcon icon={faExternalLinkAlt} />
                              </button>

                              {hasAdditionalLinks && (
                                <LinksExpandButton
                                  itemId={item.id}
                                  isExpanded={isExpanded}
                                  color={customization.buttonPrimaryColor}
                                  label={`${visibleAdditionalLinks.length} more`}
                                  onToggle={toggleLinksExpand}
                                />
                              )}
                            </div>
                          ) : hasAdditionalLinks ? (
                            <LinksExpandButton
                              itemId={item.id}
                              isExpanded={isExpanded}
                              color={customization.buttonPrimaryColor}
                              label={`${visibleAdditionalLinks.length} links`}
                              onToggle={toggleLinksExpand}
                            />
                          ) : 'N/A'}
                        </td>
                      </tr>

                      {/* Additional links row (collapsible) */}
                      {hasAdditionalLinks && (
                        <tr className={isExpanded ? '' : 'd-none'}>
                          <td colSpan={3} className="p-0">
                            <Collapse isOpen={isExpanded}>
                              <div className="p-3 bg-light">
                                <ul className="list-group list-group-flush">
                                  {visibleAdditionalLinks.map((link, idx) => (
                                    <li key={link.link_id || idx} className="list-group-item bg-transparent px-0">
                                      <div>
                                        <strong>{link.title || `Link ${idx + 1}`}</strong>
                                        <div>
                                          <a
                                            href={link.url}
                                            onClick={(e) => handleExternalLinkClick(
                                              e,
                                              'resource_link_click',
                                              link.url,
                                              item,
                                              {
                                                linkId: link.link_id,
                                                linkTitle: link.title,
                                              }
                                            )}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            style={{ color: customization.buttonPrimaryColor }}
                                          >
                                            {link.url}
                                            <FontAwesomeIcon icon={faExternalLinkAlt} className="ms-1" />
                                          </a>
                                        </div>
                                        {link.description && (
                                          <div className="text-muted small mt-1">
                                            {containsHtml(link.description) ? (
                                              <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(link.description) }} />
                                            ) : (
                                              link.description
                                            )}
                                          </div>
                                        )}
                                        {canBypassVisibility && link.use_link_visibility && (link.start_visibility || link.end_visibility) && (
                                          <div className="small text-muted mt-1">
                                            <strong>Link Visibility:</strong>{' '}
                                            {link.start_visibility ? `From ${formatVisibilityDate(link.start_visibility)}` : 'No start date'}{' '}
                                            {link.end_visibility ? `until ${formatVisibilityDate(link.end_visibility, 'end')}` : 'No end date'}
                                          </div>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </Collapse>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </Table>
        )}
      </Col>
    </Row>
  );
};

RecordTableSplitView.propTypes = {
  records: PropTypes.array.isRequired,
  context: PropTypes.object.isRequired,
};

export default RecordTableSplitView;

import PropTypes from 'prop-types';
import { Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { buildFolioVerificationUrl } from '../../../../util/urlHelpers';

function AdminPrintResourceTable({ printResources }) {
  if (!printResources || printResources.length === 0) {
    return <p>No print resources found.</p>;
  }

  return (
    <Table bordered hover responsive className="print-resource-table">
      <thead className="table-light">
        <tr>
          <th>Title</th>
          <th className="d-none d-md-table-cell">Call Number</th>
          <th>Barcode</th>
          <th className="d-none d-lg-table-cell">Location</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {printResources.map((item) => (
          <tr key={item.id}>
            <td>
              <div className="fw-bold">{item?.copiedItem?.title}</div>
              <div className="text-muted small">{item?.copiedItem?.instanceHrid}</div>
            </td>
            <td className="d-none d-md-table-cell">{item?.copiedItem?.callNumber}</td>
            <td>{item?.copiedItem?.barcode}</td>
            <td className="d-none d-lg-table-cell">
              {item?.copiedItem?.permanentLocationObject?.name || 'N/A'}
            </td>
            <td>
              <a
                href={buildFolioVerificationUrl(item?.copiedItem?.instanceId, item?.copiedItem?.holdingsId)}
                target="_blank"
                rel="noopener"
                className="btn btn-sm btn-outline-primary"
              >
                <FontAwesomeIcon icon="fa-solid fa-eye"  className="me-1" />
                View
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

AdminPrintResourceTable.propTypes = {
  printResources: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default AdminPrintResourceTable;

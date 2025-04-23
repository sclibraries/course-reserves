import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { buildFolioVerificationUrl } from '../../../../util/urlHelpers';
import { useDrag, useDrop } from 'react-dnd';

// Define item type for drag and drop
const PRINT_ITEM_TYPE = 'print-resource';

// Draggable row component
const DraggablePrintRow = ({ item, index, moveRow, onDrop }) => {
  const ref = useRef(null);
  
  const [, drop] = useDrop({
    accept: PRINT_ITEM_TYPE,
    hover(draggedItem) {
      if (!ref.current) {
        return;
      }
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      
      moveRow(dragIndex, hoverIndex);
      
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for performance reasons
      draggedItem.index = hoverIndex;
    },
        drop() {
            // fires once when the user releases the drag
            onDrop && onDrop();
        },
  });
  
  const [{ isDragging }, drag] = useDrag({
    type: PRINT_ITEM_TYPE,
    item: { id: item.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  // Initialize drag and drop refs
  drag(drop(ref));

  return (
    <tr
      ref={ref}
      className={isDragging ? 'dragging' : ''}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <td className="drag-handle">
        <FontAwesomeIcon icon="fa-solid fa-grip-vertical" />
      </td>
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
          <FontAwesomeIcon icon="fa-solid fa-eye" className="me-1" />
          View
        </a>
      </td>
    </tr>
  );
};

DraggablePrintRow.propTypes = {
  item: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  moveRow: PropTypes.func.isRequired,
  onDrop: PropTypes.func,
};

function AdminPrintResourceTable({ printResources, onReorder }) {
  const [resources, setResources] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Update local state when props change
  useEffect(() => {
    if (!printResources || !Array.isArray(printResources)) {
      setResources([]);
      return;
    }
    
    const updatedResources = printResources.map((item, index) => ({
      ...item,
      order: item.order || index + 1,
    }));
    
    setResources(updatedResources);
  }, [printResources]);

  // Handle moving rows (drag and drop)
  const moveRow = useCallback(
    (dragIndex, hoverIndex) => {
      setIsDragging(true);
      const draggedRow = resources[dragIndex];
      const newOrder = [...resources];
      
      // Remove the dragged item
      newOrder.splice(dragIndex, 1);
      // Insert it at the new position
      newOrder.splice(hoverIndex, 0, draggedRow);
      
      // Update order property on each item
      const updatedItems = newOrder.map((item, index) => ({
        ...item,
        order: index + 1
      }));
      
      setResources(updatedItems);
    },
    [resources],
  );
  
  // Save the new order when drag ends
  const handleDragEnd = useCallback(() => {
    if (onReorder && resources.length > 0 && isDragging) {
      console.log('Saving print resource order to backend');
      onReorder(resources);
      setIsDragging(false);
    }
  }, [resources, onReorder, isDragging]);


  if (!resources || resources.length === 0) {
    return <p>No print resources found.</p>;
  }

  return (
    <div className="print-resource-table-container">
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          Drag and drop resources to reorder them.
        </small>
      </div>
      
      <Table bordered hover responsive className="print-resource-table">
        <thead className="table-light">
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Title</th>
            <th className="d-none d-md-table-cell">Call Number</th>
            <th>Barcode</th>
            <th className="d-none d-lg-table-cell">Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((item, index) => (
            <DraggablePrintRow
              key={item.id || `print-${index}`}
              item={item}
              index={index}
              moveRow={moveRow}
              onDrop={handleDragEnd}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
}

AdminPrintResourceTable.propTypes = {
  printResources: PropTypes.arrayOf(PropTypes.object).isRequired,
  onReorder: PropTypes.func
};

export default AdminPrintResourceTable;

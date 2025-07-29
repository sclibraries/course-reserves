import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { buildFolioVerificationUrl } from '../../../../util/urlHelpers';
import { useDrag, useDrop } from 'react-dnd';
import ResourceSortDropdown from '../ResourceSortDropdown';
import { applySortOrder, isManualSort } from '../../../../utils/resourceSorting';
import { useResourceSortStore } from '../../../../store/resourceSortStore';

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

/**
 * Static (non-draggable) row component for sorted print resources
 */
const StaticPrintRow = ({ item }) => {
  return (
    <tr>
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

StaticPrintRow.propTypes = {
  item: PropTypes.object.isRequired,
};

function AdminPrintResourceTable({ 
  printResources, 
  onReorder,
  currentSort: externalCurrentSort,
  onSortChange: externalOnSortChange,
  isDropdownOpen: externalIsDropdownOpen,
  setDropdownOpen: externalSetDropdownOpen
}) {
  const [isDragging, setIsDragging] = useState(false);

  // Get sort state from Zustand store, fallback to props for unified view
  const { 
    physicalSort, 
    setPhysicalSort
  } = useResourceSortStore();

  // Use external sort state if provided (unified view), fallback to store state (split view)
  const [internalIsDropdownOpen, setInternalDropdownOpen] = useState(false);
  const [resources, setResources] = useState([]);
  
  const currentSort = externalCurrentSort !== undefined ? externalCurrentSort : physicalSort;
  const onSortChange = externalOnSortChange || setPhysicalSort;
  const isDropdownOpen = externalIsDropdownOpen !== undefined ? externalIsDropdownOpen : internalIsDropdownOpen;
  const setDropdownOpen = externalSetDropdownOpen || setInternalDropdownOpen;

  // Handle sort change
  const handleSortChange = useCallback((newSortType) => {
    onSortChange(newSortType);
    
    if (isManualSort(newSortType)) {
      // For manual sort, don't change the order - just update the sorting method
      return;
    }
    
    // Apply the new sort and update backend if not manual
    const sortedData = applySortOrder(resources.map(res => ({
      ...res,
      resourceType: 'print', // Add resourceType for sorting
      name: res.copiedItem?.title || '', // Map title to name for sorting
    })), newSortType);
    
    // Remove the temporary fields we added
    const cleanedData = sortedData.map(({ resourceType: _, name: __, ...rest }) => rest);
    setResources(cleanedData);
    
    // Send the new order to the backend
    if (onReorder && cleanedData.length > 0) {
      onReorder(cleanedData);
    }
  }, [resources, onReorder, onSortChange, setResources]);
  
  // Update local state when props change and store in Zustand if in split view
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
  }, [printResources, setResources, externalCurrentSort]);

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
    [resources, setResources],
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
      <ResourceSortDropdown
        currentSort={currentSort}
        onSortChange={handleSortChange}
        isDropdownOpen={isDropdownOpen}
        setDropdownOpen={setDropdownOpen}
      />
      
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          {currentSort === 'manual' 
            ? 'Drag and drop resources to reorder them.'
            : `Resources are sorted by ${currentSort.replace('-', ' ')}. Switch to Manual to enable drag and drop.`
          }
        </small>
      </div>
      
      <Table bordered hover responsive className="print-resource-table">
        <thead className="table-light">
          <tr>
            {currentSort === 'manual' && <th style={{ width: '40px' }}></th>}
            <th>Title</th>
            <th className="d-none d-md-table-cell">Call Number</th>
            <th>Barcode</th>
            <th className="d-none d-lg-table-cell">Location</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((item, index) => (
            currentSort === 'manual' ? (
              <DraggablePrintRow
                key={item.id || `print-${index}`}
                item={item}
                index={index}
                moveRow={moveRow}
                onDrop={handleDragEnd}
              />
            ) : (
              <StaticPrintRow
                key={item.id || `print-${index}`}
                item={item}
              />
            )
          ))}
        </tbody>
      </Table>
    </div>
  );
}

AdminPrintResourceTable.propTypes = {
  printResources: PropTypes.arrayOf(PropTypes.object).isRequired,
  onReorder: PropTypes.func,
  currentSort: PropTypes.string,
  onSortChange: PropTypes.func,
  isDropdownOpen: PropTypes.bool,
  setDropdownOpen: PropTypes.func
};

export default AdminPrintResourceTable;

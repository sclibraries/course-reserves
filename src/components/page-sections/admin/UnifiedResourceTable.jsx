import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDrag, useDrop } from 'react-dnd';
import { buildFolioVerificationUrl } from '../../../util/urlHelpers';

// Define item type for drag and drop
const UNIFIED_ITEM_TYPE = 'unified-resource';

/**
 * Draggable component for both electronic and print resources
 */
const DraggableResourceRow = ({ item, index, moveRow, onDrop }) => {
  const ref = useRef(null);
  
  const [, drop] = useDrop({
    accept: UNIFIED_ITEM_TYPE,
    hover(draggedItem) {
      if (!ref.current) return;
      
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      
      if (dragIndex === hoverIndex) return;
      
      moveRow(dragIndex, hoverIndex);
      draggedItem.index = hoverIndex;
    },
    drop() {
      onDrop && onDrop();
    },
  });
  
  const [{ isDragging }, drag] = useDrag({
    type: UNIFIED_ITEM_TYPE,
    item: { id: item.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  drag(drop(ref));
  
  // Render differently based on resource type
  if (item.resourceType === 'electronic') {
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
          <span className="badge bg-info me-2">Electronic</span>
        </td>
        <td className="text-break">{item.name}</td>
        <td>
          {item.item_url ? (
            <a href={item.item_url} target="_blank" rel="noreferrer">
              {item.item_url}
            </a>
          ) : (
            '—'
          )}
        </td>
        <td>
          <Button 
            size="sm" 
            color="danger" 
            onClick={() => item.onUnlink && item.onUnlink(item.course_resource_id)}
          >
            Unlink
          </Button>
        </td>
      </tr>
    );
  } else {
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
          <span className="badge bg-secondary me-2">Print</span>
        </td>
        <td>{item?.copiedItem?.title}</td>
        <td>{item?.copiedItem?.callNumber || '—'}</td>
        <td>
          <a
            href={buildFolioVerificationUrl(item?.copiedItem?.instanceId, item?.copiedItem?.holdingsId)}
            target="_blank"
            rel="noopener"
            className="btn btn-sm btn-outline-primary"
          >
            View
          </a>
        </td>
      </tr>
    );
  }
};

/**
 * UnifiedResourceTable combines electronic and print resources into a single
 * sortable table that maintains a shared order between them.
 */
function UnifiedResourceTable({
  electronicResources,
  printResources,
  onReorder,
  unlinkResource
}) {
  const [resources, setResources] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Combine resources with type information
  useEffect(() => {
    const electronic = Array.isArray(electronicResources) ? 
      electronicResources.map(res => ({
        ...res,
        resourceType: 'electronic',
        id: `e-${res.resource_id}`,
        order: res.order || 999,
        onUnlink: unlinkResource
      })) : [];
      
    const print = Array.isArray(printResources) ? 
      printResources.map(res => ({
        ...res,
        resourceType: 'print',
        id: `p-${res.id}`,
        order: res.order || 999
      })) : [];
    
    // Combine and sort by order
    const combined = [...electronic, ...print];
    combined.sort((a, b) => a.order - b.order);
    
    setResources(combined);
  }, [electronicResources, printResources, unlinkResource]);

  // Handle row movement
  const moveRow = useCallback((dragIndex, hoverIndex) => {
    setIsDragging(true);
    const draggedRow = resources[dragIndex];
    const newOrder = [...resources];
    
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedRow);
    
    // Update order property
    const updatedItems = newOrder.map((item, index) => ({
      ...item,
      order: index + 1
    }));
    
    setResources(updatedItems);
  }, [resources]);

  // Handle drag end and update backend
  const handleDragEnd = useCallback(() => {
    if (onReorder && resources.length > 0 && isDragging) {
      // Split resources back into their types
      const electronic = [];
      const print = [];
      
      resources.forEach((resource, index) => {
        const order = index + 1;
        
        if (resource.resourceType === 'electronic') {
          electronic.push({
            resource_id: resource.resource_id,
            order
          });
        } else {
          print.push({
            id: resource.id.replace('p-', ''),
            order,
            copiedItem: resource.copiedItem
          });
        }
      });
      
      // Send updates to backend
      onReorder({
        electronic,
        print
      });
      
      setIsDragging(false);
    }
  }, [resources, onReorder, isDragging]);

  if (!resources.length) {
    return (
      <Alert color="info">No resources available to sort.</Alert>
    );
  }

  return (
    <div className="unified-resource-table mb-4">
      <div className="mb-3">
        <small className="text-muted">
          <FontAwesomeIcon icon="fa-solid fa-info-circle" className="me-1" />
          Drag and drop resources to reorder. This view shows both electronic and print resources together.
        </small>
      </div>
      
      <Table bordered responsive hover>
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th style={{ width: '120px' }}>Type</th>
            <th>Title</th>
            <th>Information</th>
            <th style={{ width: '100px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((item, index) => (
            <DraggableResourceRow
              key={item.id}
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

UnifiedResourceTable.propTypes = {
  electronicResources: PropTypes.array,
  printResources: PropTypes.array,
  onReorder: PropTypes.func.isRequired,
  unlinkResource: PropTypes.func
};

export default UnifiedResourceTable;

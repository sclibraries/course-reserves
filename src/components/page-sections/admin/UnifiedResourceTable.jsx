import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Table, Button, Alert, Input, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDrag, useDrop } from 'react-dnd';
import { buildFolioVerificationUrl } from '../../../util/urlHelpers';
import ResourceSortDropdown from './ResourceSortDropdown';
import BulkOperationsPanel from './BulkOperationsPanel';
import { applySortOrder, isManualSort } from '../../../utils/resourceSorting';

// Define item type for drag and drop
const UNIFIED_ITEM_TYPE = 'unified-resource';

/**
 * Draggable component for both electronic and print resources
 */
const DraggableResourceRow = ({ item, index, moveRow, onDrop, isSelected, onSelect, onEdit }) => {
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
        className={`${isDragging ? 'dragging' : ''} ${isSelected ? 'table-primary' : ''}`}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <td className="text-center" style={{ width: '40px' }}>
          <Input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item.id, e.target.checked)}
          />
        </td>
        <td className="drag-handle">
          <FontAwesomeIcon icon="fa-solid fa-grip-vertical" />
        </td>
        <td>
          <span className="badge bg-info me-2">Electronic</span>
        </td>
        <td className="text-break">{item.name}</td>
        <td style={{ maxWidth: '200px', overflow: 'hidden' }}>
          {item.item_url ? (
            <a 
              href={item.item_url} 
              target="_blank" 
              rel="noreferrer"
              className="text-truncate d-block"
              title={item.item_url}
            >
              {item.item_url}
            </a>
          ) : (
            '—'
          )}
        </td>
        <td>
          <div className="d-flex gap-2">
            <Button 
              size="sm" 
              color="danger" 
              onClick={() => item.onUnlink && item.onUnlink(item.course_resource_id)}
            >
              Unlink
            </Button>
            <Button 
              color="primary" 
              size="sm"
              onClick={() => onEdit && onEdit(item)}
              aria-label={`Edit ${item.name}`}
            >
              Edit
            </Button>
          </div>
        </td>
      </tr>
    );
  } else {
    return (
      <tr 
        ref={ref} 
        className={`${isDragging ? 'dragging' : ''} ${isSelected ? 'table-primary' : ''}`}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <td className="text-center" style={{ width: '40px' }}>
          <Input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item.id, e.target.checked)}
          />
        </td>
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

// Add PropTypes for DraggableResourceRow
DraggableResourceRow.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    resourceType: PropTypes.string,
    name: PropTypes.string,
    item_url: PropTypes.string,
    onUnlink: PropTypes.func,
    course_resource_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    resource_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    order: PropTypes.number,
    copiedItem: PropTypes.shape({
      title: PropTypes.string,
      callNumber: PropTypes.string,
      instanceId: PropTypes.string,
      holdingsId: PropTypes.string,
      copy: PropTypes.string
    })
  }).isRequired,
  index: PropTypes.number.isRequired,
  moveRow: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onEdit: PropTypes.func
};

/**
 * Static (non-draggable) component for sorted resources
 */
const StaticResourceRow = ({ item, isSelected, onSelect, onEdit }) => {
  // Render differently based on resource type
  if (item.resourceType === 'electronic') {
    return (
      <tr className={isSelected ? 'table-primary' : ''}>
        <td className="text-center" style={{ width: '40px' }}>
          <Input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item.id, e.target.checked)}
          />
        </td>
        <td>
          <span className="badge bg-info me-2">Electronic</span>
        </td>
        <td className="text-break">{item.name}</td>
        <td style={{ maxWidth: '200px', overflow: 'hidden' }}>
          {item.item_url ? (
            <a 
              href={item.item_url} 
              target="_blank" 
              rel="noreferrer"
              className="text-truncate d-block"
              title={item.item_url}
            >
              {item.item_url}
            </a>
          ) : (
            '—'
          )}
        </td>
        <td>
          <div className="d-flex gap-2">
            <Button 
              size="sm" 
              color="danger" 
              onClick={() => item.onUnlink && item.onUnlink(item.course_resource_id)}
            >
              Unlink
            </Button>
            <Button 
              color="primary" 
              size="sm"
              onClick={() => onEdit && onEdit(item)}
              aria-label={`Edit ${item.name}`}
            >
              Edit
            </Button>
          </div>
        </td>
      </tr>
    );
  } else {
    return (
      <tr className={isSelected ? 'table-primary' : ''}>
        <td className="text-center" style={{ width: '40px' }}>
          <Input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item.id, e.target.checked)}
          />
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

// Add PropTypes for StaticResourceRow
StaticResourceRow.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    resourceType: PropTypes.string,
    name: PropTypes.string,
    item_url: PropTypes.string,
    onUnlink: PropTypes.func,
    course_resource_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    resource_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    order: PropTypes.number,
    copiedItem: PropTypes.shape({
      title: PropTypes.string,
      callNumber: PropTypes.string,
      instanceId: PropTypes.string,
      holdingsId: PropTypes.string,
      copy: PropTypes.string
    })
  }).isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onEdit: PropTypes.func
};

/**
 * UnifiedResourceTable combines electronic and print resources into a single
 * sortable table that maintains a shared order between them.
 */
function UnifiedResourceTable({
  electronicResources,
  printResources,
  onReorder,
  unlinkResource,
  currentSort: externalCurrentSort,
  onSortChange: externalOnSortChange,
  isDropdownOpen: externalIsDropdownOpen,
  setDropdownOpen: externalSetDropdownOpen,
  editResourceModal
}) {
  const [resources, setResources] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkOps, setShowBulkOps] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Use external sort state if provided, fallback to internal state
  const [internalCurrentSort, setInternalCurrentSort] = useState('manual');
  const [internalIsDropdownOpen, setInternalDropdownOpen] = useState(false);
  
  const currentSort = externalCurrentSort !== undefined ? externalCurrentSort : internalCurrentSort;
  const onSortChange = externalOnSortChange || setInternalCurrentSort;
  const isDropdownOpen = externalIsDropdownOpen !== undefined ? externalIsDropdownOpen : internalIsDropdownOpen;
  const setDropdownOpen = externalSetDropdownOpen || setInternalDropdownOpen;

  // Update showBulkOps when selection changes
  useEffect(() => {
    setShowBulkOps(selectedItems.length > 0);
  }, [selectedItems]);

  // Apply sort when currentSort changes externally (but not when resources change)
  useEffect(() => {
    if (!isManualSort(currentSort) && resources.length > 0) {
      const sortedResources = applySortOrder([...resources], currentSort);
      // Only update if the order actually changed
      const currentIds = resources.map(r => r.id).join(',');
      const sortedIds = sortedResources.map(r => r.id).join(',');
      
      if (currentIds !== sortedIds) {
        setResources(sortedResources);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSort]); // Intentionally only watching currentSort

  // Handle sort change
  const handleSortChange = useCallback((newSortType) => {
    onSortChange(newSortType);
    
    if (isManualSort(newSortType)) {
      // For manual sort, don't change the order - just update the sorting method
      return;
    }
    
    // Apply the new sort locally only
    const sortedResources = applySortOrder(resources, newSortType);
    
    // Update order properties for the sorted resources
    sortedResources.forEach((resource, index) => {
      resource.order = index + 1;
    });
    
    setResources(sortedResources);
    setHasPendingChanges(true); // Mark changes as pending for sort operations too
    
    // Note: Backend update moved to manual "Update Order" button
  }, [resources, onSortChange]);

  // Selection handlers
  const handleSelectItem = useCallback((itemId, isSelected) => {
    setSelectedItems(prev => {
      if (isSelected) {
        return [...prev, itemId];
      } else {
        return prev.filter(id => id !== itemId);
      }
    });
  }, []);

  const handleSelectAll = useCallback((selectAll) => {
    if (selectAll) {
      setSelectedItems(resources.map(r => r.id));
    } else {
      setSelectedItems([]);
    }
  }, [resources]);

  const handleClearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  // Edit handler for electronic resources
  const handleEditResource = useCallback((resource) => {
    if (editResourceModal && resource.resourceType === 'electronic') {
      editResourceModal.openEditResourceForm(resource);
    }
  }, [editResourceModal]);

  // Bulk operations handler
  const handleBulkMove = useCallback((selectedResources, operation, value) => {
    const newResources = [...resources];
    
    // Remove selected items from their current positions
    const otherResources = newResources.filter(r => !selectedItems.includes(r.id));
    const selectedResourcesOrdered = selectedResources.sort((a, b) => 
      newResources.findIndex(r => r.id === a.id) - newResources.findIndex(r => r.id === b.id)
    );

    let finalResources = [];

    switch (operation) {
      case 'moveToTop':
        finalResources = [...selectedResourcesOrdered, ...otherResources];
        break;
      
      case 'moveToBottom':
        finalResources = [...otherResources, ...selectedResourcesOrdered];
        break;
      
      case 'moveAfter': {
        const targetIndex = otherResources.findIndex(r => r.id === value);
        if (targetIndex !== -1) {
          finalResources = [
            ...otherResources.slice(0, targetIndex + 1),
            ...selectedResourcesOrdered,
            ...otherResources.slice(targetIndex + 1)
          ];
        } else {
          finalResources = [...otherResources, ...selectedResourcesOrdered];
        }
        break;
      }
      
      case 'moveToPosition': {
        const position = Math.max(1, Math.min(value, otherResources.length + selectedResourcesOrdered.length));
        const insertIndex = position - 1;
        
        if (insertIndex === 0) {
          finalResources = [...selectedResourcesOrdered, ...otherResources];
        } else if (insertIndex >= otherResources.length) {
          finalResources = [...otherResources, ...selectedResourcesOrdered];
        } else {
          finalResources = [
            ...otherResources.slice(0, insertIndex),
            ...selectedResourcesOrdered,
            ...otherResources.slice(insertIndex)
          ];
        }
        break;
      }
      
      case 'moveUp': {
        // Find the earliest position of selected items
        const selectedIndices = selectedResources.map(res => 
          newResources.findIndex(r => r.id === res.id)
        ).sort((a, b) => a - b);
        
        const firstSelectedIndex = selectedIndices[0];
        
        // Can't move up if already at the top
        if (firstSelectedIndex === 0) {
          finalResources = newResources;
          break;
        }
        
        // Move all selected items up by one position
        finalResources = [...newResources];
        selectedIndices.forEach(currentIndex => {
          if (currentIndex > 0) {
            // Swap with the item above
            [finalResources[currentIndex], finalResources[currentIndex - 1]] = 
            [finalResources[currentIndex - 1], finalResources[currentIndex]];
          }
        });
        break;
      }
      
      case 'moveDown': {
        // Find the latest position of selected items
        const selectedIndices = selectedResources.map(res => 
          newResources.findIndex(r => r.id === res.id)
        ).sort((a, b) => b - a); // Sort descending
        
        const lastSelectedIndex = selectedIndices[0];
        
        // Can't move down if already at the bottom
        if (lastSelectedIndex === newResources.length - 1) {
          finalResources = newResources;
          break;
        }
        
        // Move all selected items down by one position
        finalResources = [...newResources];
        selectedIndices.forEach(currentIndex => {
          if (currentIndex < finalResources.length - 1) {
            // Swap with the item below
            [finalResources[currentIndex], finalResources[currentIndex + 1]] = 
            [finalResources[currentIndex + 1], finalResources[currentIndex]];
          }
        });
        break;
      }
      
      default:
        finalResources = newResources;
    }

    // Update order properties
    finalResources.forEach((resource, index) => {
      resource.order = index + 1;
    });

    setResources(finalResources);
    setHasPendingChanges(true); // Mark that we have unsaved changes
    
    // Only clear selection for major moves, preserve for incremental arrow moves
    if (operation !== 'moveUp' && operation !== 'moveDown') {
      setSelectedItems([]);
    }

    // Note: Backend update moved to manual "Update Order" button
  }, [resources, selectedItems]);

  // Combine resources with type information
  useEffect(() => {
    const electronic = Array.isArray(electronicResources) ? 
      electronicResources.map(res => ({
        ...res,
        resourceType: 'electronic',
        id: `e-${res.resource_id}`,
        order: parseInt(res.order) || 999,
        course_resource_id: res.course_resource_id,
        onUnlink: unlinkResource
      })) : [];
      
    const print = Array.isArray(printResources) ? 
      printResources.map(res => ({
        ...res,
        resourceType: 'print',
        id: `p-${res.id}`,
        order: parseInt(res.order) || 999
      })) : [];
    
    const allResources = [...electronic, ...print];
    
    // Check if we have manual ordering (any order that's not 999)
    const hasManualOrder = allResources.some(res => 
      res.order !== null && res.order !== undefined && res.order !== 999
    );
    
    console.log('UnifiedResourceTable sorting:', {
      hasManualOrder,
      electronicCount: electronic.length,
      printCount: print.length,
      currentSort,
      allOrders: allResources.map(r => ({ type: r.resourceType, order: r.order, id: r.id }))
    });
    
    let sortedResources = [];
    
    if (currentSort !== 'manual') {
      // Apply the selected sort method
      sortedResources = applySortOrder(allResources, currentSort);
      console.log(`Using ${currentSort} sorting`);
    } else if (hasManualOrder) {
      // Manual ordering exists - sort all resources by order field
      sortedResources = allResources.sort((a, b) => {
        // Treat 999 as a very high number for sorting
        const orderA = a.order === 999 ? 999999 : (a.order || 999999);
        const orderB = b.order === 999 ? 999999 : (b.order || 999999);
        return orderA - orderB;
      });
      console.log('Using manual order sorting, final order:', 
        sortedResources.map(r => ({ 
          type: r.resourceType, 
          order: r.order, 
          title: r.name || r.copiedItem?.title,
          id: r.resourceType === 'electronic' ? r.resource_id : r.copiedItem?.instanceId
        }))
      );
    } else {
      // No manual ordering - use default behavior
      if (electronic.length > 0 && print.length === 0) {
        // Only electronic resources - sort by course_resource_id
        sortedResources = electronic.sort((a, b) => (a.course_resource_id || 0) - (b.course_resource_id || 0));
        console.log('Electronic only - sorting by course_resource_id:', 
          sortedResources.map(r => ({ course_resource_id: r.course_resource_id, order: r.order, title: r.name }))
        );
      } else {
        // Mixed or print only - electronic first by course_resource_id, then print by order
        electronic.sort((a, b) => (a.course_resource_id || 0) - (b.course_resource_id || 0));
        print.sort((a, b) => (a.order || 0) - (b.order || 0));
        sortedResources = [...electronic, ...print];
        console.log('Mixed resources - electronic first, then print');
      }
    }
    
    setResources(sortedResources);
  }, [electronicResources, printResources, unlinkResource, currentSort]);

  // Manual update function to send changes to backend
  const handleUpdateOrder = useCallback(async () => {
    if (!onReorder || !hasPendingChanges || resources.length === 0) return;

    setIsUpdating(true);
    
    try {
      const electronic = [];
      const print = [];
      
      resources.forEach((resource) => {
        if (resource.resourceType === 'electronic') {
          electronic.push({
            ...resource,
            resource_id: resource.resource_id,
            course_resource_id: resource.course_resource_id,
            order: resource.order
          });
        } else {
          print.push({
            ...resource,
            id: resource.id,
            order: resource.order,
            copiedItem: resource.copiedItem
          });
        }
      });
      
      await onReorder({
        electronic,
        print
      });
      
      setHasPendingChanges(false); // Clear pending changes flag
      onSortChange('manual'); // Reset to default order to show backend-provided order
    } catch (error) {
      console.error('Error updating order:', error);
      // You could add error handling/toast here
    } finally {
      setIsUpdating(false);
    }
  }, [onReorder, hasPendingChanges, resources, onSortChange]);

  // Handle row movement (only active in manual mode)
  const moveRow = useCallback((dragIndex, hoverIndex) => {
    if (currentSort !== 'manual') return; // Disable drag in non-manual modes
    
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
    setHasPendingChanges(true); // Mark changes as pending for drag operations too
  }, [resources, currentSort]);

  // Handle drag end (only active in manual mode)
  const handleDragEnd = useCallback(() => {
    if (isDragging && currentSort === 'manual') {
      console.log('Drag ended');
      setIsDragging(false);
      // Note: Backend update moved to manual "Update Order" button
    }
  }, [isDragging, currentSort]);

  if (!resources.length) {
    return (
      <Alert color="info">No resources available to sort.</Alert>
    );
  }

  const allSelected = resources.length > 0 && selectedItems.length === resources.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < resources.length;

  return (
    <div className="unified-resource-table mb-4">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <ResourceSortDropdown
          currentSort={currentSort}
          onSortChange={handleSortChange}
          isDropdownOpen={isDropdownOpen}
          setDropdownOpen={setDropdownOpen}
        />
        
        {hasPendingChanges && (
          <Button
            color="success"
            size="sm"
            onClick={handleUpdateOrder}
            disabled={isUpdating}
            className="d-flex align-items-center"
          >
            {isUpdating ? (
              <>
                <Spinner size="sm" className="me-2" />
                Updating...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon="fa-solid fa-save" className="me-2" />
                Update Order
              </>
            )}
          </Button>
        )}
      </div>

      <BulkOperationsPanel
        selectedItems={selectedItems}
        resources={resources}
        onBulkMove={handleBulkMove}
        onClearSelection={handleClearSelection}
        isVisible={showBulkOps}
      />
      
      <div className="mb-3">
        <small className={hasPendingChanges ? "text-warning" : "text-muted"}>
          <FontAwesomeIcon icon={hasPendingChanges ? "fa-solid fa-exclamation-triangle" : "fa-solid fa-info-circle"} className="me-1" />
          {hasPendingChanges 
            ? 'You have unsaved changes. Click "Update Order" to save your sorting/reordering to the server.'
            : currentSort === 'manual' 
              ? 'Using default order (custom order + creation order). Select resources for bulk operations, drag and drop, or use arrow buttons to reorder individually.'
              : `Resources are sorted by ${currentSort.replace('-', ' ')}. All sorting is applied locally - click "Update Order" to save the new order to the server.`
          }
        </small>
      </div>
      
      <Table bordered responsive hover>
        <thead>
          <tr>
            <th style={{ width: '40px', minWidth: '40px' }}>
              <Input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                title={allSelected ? 'Deselect all' : 'Select all'}
              />
            </th>
            {currentSort === 'manual' && <th style={{ width: '40px', minWidth: '40px' }}></th>}
            <th style={{ width: '120px', minWidth: '120px' }}>Type</th>
            <th style={{ width: '35%', minWidth: '200px' }}>Title</th>
            <th style={{ width: 'auto', minWidth: '150px' }}>Information</th>
            <th style={{ width: '120px', minWidth: '120px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((item, index) => {
            const isSelected = selectedItems.includes(item.id);
            
            return currentSort === 'manual' ? (
              <DraggableResourceRow
                key={item.id}
                item={item}
                index={index}
                moveRow={moveRow}
                onDrop={handleDragEnd}
                isSelected={isSelected}
                onSelect={handleSelectItem}
                onEdit={handleEditResource}
              />
            ) : (
              <StaticResourceRow
                key={item.id}
                item={item}
                isSelected={isSelected}
                onSelect={handleSelectItem}
                onEdit={handleEditResource}
              />
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

UnifiedResourceTable.propTypes = {
  electronicResources: PropTypes.array,
  printResources: PropTypes.array,
  onReorder: PropTypes.func.isRequired,
  unlinkResource: PropTypes.func,
  currentSort: PropTypes.string,
  onSortChange: PropTypes.func,
  isDropdownOpen: PropTypes.bool,
  setDropdownOpen: PropTypes.func,
  editResourceModal: PropTypes.shape({
    openEditResourceForm: PropTypes.func.isRequired
  })
};

export default UnifiedResourceTable;

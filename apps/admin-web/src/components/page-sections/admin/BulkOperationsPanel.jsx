import { useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardBody, Row, Col, Button, Input, Label, Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const BulkOperationsPanel = ({ selectedItems, resources, onBulkMove, onClearSelection, isVisible }) => {
  const [moveAfterItem, setMoveAfterItem] = useState('');
  const [directPosition, setDirectPosition] = useState('');

  if (!isVisible || selectedItems.length === 0) {
    return null;
  }

  const handleBulkMove = (operation, value = null) => {
    const selectedResources = resources.filter(r => selectedItems.includes(r.id));
    onBulkMove(selectedResources, operation, value);
  };

  const handleMoveAfter = () => {
    if (moveAfterItem) {
      handleBulkMove('moveAfter', moveAfterItem);
      setMoveAfterItem('');
    }
  };

  const handleDirectPosition = () => {
    const position = parseInt(directPosition);
    if (position && position > 0) {
      handleBulkMove('moveToPosition', position);
      setDirectPosition('');
    }
  };

  const availableItems = resources.filter(r => !selectedItems.includes(r.id));

  return (
    <Card className="mb-3 border-primary">
      <CardBody className="py-2">
        <Row className="align-items-center">
          <Col md={3}>
            <div className="d-flex align-items-center">
              <Badge color="primary" className="me-2">
                {selectedItems.length} selected
              </Badge>
              <Button
                size="sm"
                color="outline-danger"
                onClick={onClearSelection}
                title="Clear selection when done reordering"
              >
                <FontAwesomeIcon icon="fa-solid fa-times" className="me-1" />
                Clear
              </Button>
            </div>
          </Col>
          
          <Col md={9}>
            <Row className="g-2">
              {/* Quick move buttons */}
              <Col xs="auto">
                <Button
                  size="sm"
                  color="primary"
                  onClick={() => handleBulkMove('moveToTop')}
                  title="Move selected to top"
                >
                  <FontAwesomeIcon icon="fa-solid fa-arrow-up" className="me-1" />
                  Top
                </Button>
              </Col>
              
              <Col xs="auto">
                <Button
                  size="sm"
                  color="primary"
                  onClick={() => handleBulkMove('moveToBottom')}
                  title="Move selected to bottom"
                >
                  <FontAwesomeIcon icon="fa-solid fa-arrow-down" className="me-1" />
                  Bottom
                </Button>
              </Col>

              {/* Move up/down one position */}
              <Col xs="auto">
                <Button
                  size="sm"
                  color="secondary"
                  onClick={() => handleBulkMove('moveUp')}
                  title="Move selected up one position (keeps selection)"
                >
                  <FontAwesomeIcon icon="fa-solid fa-chevron-up" />
                </Button>
              </Col>
              
              <Col xs="auto">
                <Button
                  size="sm"
                  color="secondary"
                  onClick={() => handleBulkMove('moveDown')}
                  title="Move selected down one position (keeps selection)"
                >
                  <FontAwesomeIcon icon="fa-solid fa-chevron-down" />
                </Button>
              </Col>

              {/* Move after specific item */}
              <Col xs="auto" className="d-flex align-items-center">
                <Label className="me-2 mb-0 small">Move after:</Label>
                <div className="d-flex">
                  <Input
                    type="select"
                    size="sm"
                    value={moveAfterItem}
                    onChange={(e) => setMoveAfterItem(e.target.value)}
                    style={{ width: '150px' }}
                  >
                    <option value="">Select item...</option>
                    {availableItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.resourceType === 'electronic' 
                          ? item.name?.substring(0, 30) + '...'
                          : item.copiedItem?.title?.substring(0, 30) + '...'
                        }
                      </option>
                    ))}
                  </Input>
                  <Button
                    size="sm"
                    color="secondary"
                    className="ms-1"
                    onClick={handleMoveAfter}
                    disabled={!moveAfterItem}
                  >
                    Move
                  </Button>
                </div>
              </Col>

              {/* Direct position */}
              <Col xs="auto" className="d-flex align-items-center">
                <Label className="me-2 mb-0 small">Position:</Label>
                <div className="d-flex">
                  <Input
                    type="number"
                    size="sm"
                    value={directPosition}
                    onChange={(e) => setDirectPosition(e.target.value)}
                    placeholder="1"
                    min="1"
                    max={resources.length}
                    style={{ width: '70px' }}
                  />
                  <Button
                    size="sm"
                    color="secondary"
                    className="ms-1"
                    onClick={handleDirectPosition}
                    disabled={!directPosition}
                  >
                    Go
                  </Button>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </CardBody>
    </Card>
  );
};

BulkOperationsPanel.propTypes = {
  selectedItems: PropTypes.array.isRequired,
  resources: PropTypes.array.isRequired,
  onBulkMove: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  isVisible: PropTypes.bool.isRequired
};

export default BulkOperationsPanel;

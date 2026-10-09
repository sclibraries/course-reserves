/**
 * @file ItemDetailsWithCommunications.jsx
 * @description Tabbed interface showing item details and communications
 */

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';
import {
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Button,
  ButtonGroup
} from 'reactstrap';
import {
  FaInfoCircle,
  FaComments,
  FaExternalLinkAlt,
  FaEnvelope,
  FaComment,
  FaStickyNote,
  FaShoppingCart,
  FaBook
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import CommunicationsPanel from './CommunicationsPanel';
import './ItemDetailsWithCommunications.css';

const ItemDetailsWithCommunications = ({ 
  item, 
  onStaffMessage,
  onFacultyMessage,
  onAddNote,
  refreshTrigger
}) => {
  const [searchParams] = useSearchParams();
  const focusItemId = searchParams.get('item');
  
  // Default to communications tab if item is in URL (coming from mentions)
  const [activeTab, setActiveTab] = useState(focusItemId ? 'communications' : 'details');
  const commsPanelRef = useRef();

  const toggleTab = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };
  
  // Switch to communications tab when item ID appears in URL
  useEffect(() => {
    if (focusItemId) {
      console.log('ItemDetailsWithCommunications - Item in URL, switching to communications tab');
      setActiveTab('communications');
    }
  }, [focusItemId]);
  
  // Watch for refreshTrigger changes and refresh communications
  useEffect(() => {
    if (refreshTrigger && commsPanelRef.current?.refresh) {
      commsPanelRef.current.refresh();
    }
  }, [refreshTrigger]);

  // Get submission ID for communications
  const submissionId = item.submission_id || item.submission?.submission_id || item.submission?.id;
  
  // Debug log
  console.log('ItemDetailsWithCommunications - Item:', {
    itemId: item.id,
    submissionId: submissionId,
    submissionObject: item.submission,
    fullItem: item
  });

  return (
    <div className="item-details-with-comms">
      {/* Tab Navigation */}
      <Nav tabs className="details-tabs">
        <NavItem>
          <NavLink
            className={activeTab === 'details' ? 'active' : ''}
            onClick={() => toggleTab('details')}
          >
            <FaInfoCircle className="me-1" />
            Item Details
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={activeTab === 'communications' ? 'active' : ''}
            onClick={() => toggleTab('communications')}
          >
            <FaComments className="me-1" />
            Communications
            {/* TODO: Add unread badge here */}
          </NavLink>
        </NavItem>
      </Nav>

      {/* Tab Content */}
      <TabContent activeTab={activeTab} className="details-tab-content">
        {/* Details Tab */}
        <TabPane tabId="details">
          <div className="details-grid">
            {/* Left Column */}
            <div className="details-column">
              <h6>Item Information</h6>
              
              {item.barcode && (
                <div className="detail-item">
                  <strong>Barcode:</strong> {item.barcode}
                </div>
              )}
              
              {item.callNumber && (
                <div className="detail-item">
                  <strong>Call Number:</strong> {item.callNumber}
                </div>
              )}
              
              {item.url && (
                <div className="detail-item">
                  <strong>URL:</strong>{' '}
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.url.substring(0, 50)}... <FaExternalLinkAlt size={10} />
                  </a>
                </div>
              )}

              {item.faculty_notes && (
                <div className="detail-item">
                  <strong>Faculty Notes:</strong>
                  <div className="faculty-notes-box">{item.faculty_notes}</div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="details-column">
              <h6>Course Context</h6>
              
              <div className="detail-item">
                <strong>Course:</strong> {item.submission?.course_code} - {item.submission?.course_title}
              </div>
              
              <div className="detail-item">
                <strong>Faculty:</strong> {item.submission?.faculty_display_name}
              </div>
              
              <div className="detail-item">
                <strong>Term:</strong> {item.submission?.term_code}
              </div>

              {item.staff_notes && (
                <div className="detail-item">
                  <strong>Staff Notes:</strong>
                  <div className="staff-notes-box">{item.staff_notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="details-actions mt-3 pt-3 border-top">
            <ButtonGroup>
              <Button size="sm" outline color="primary" onClick={onFacultyMessage}>
                <FaEnvelope className="me-1" />
                Message Faculty
              </Button>
              <Button size="sm" outline color="info" onClick={onStaffMessage}>
                <FaComment className="me-1" />
                Message Staff
              </Button>
              <Button size="sm" outline color="warning" onClick={() => toast.info('Acquisitions handoff coming soon')}>
                <FaShoppingCart className="me-1" />
                Acquisitions
              </Button>
              <Button size="sm" outline color="info" onClick={() => toast.info('ILL handoff coming soon')}>
                <FaBook className="me-1" />
                ILL
              </Button>
              <Button size="sm" outline color="secondary" onClick={onAddNote}>
                <FaStickyNote className="me-1" />
                Quick Note
              </Button>
            </ButtonGroup>
          </div>
        </TabPane>

        {/* Communications Tab */}
        <TabPane tabId="communications">
          <div className="communications-tab-wrapper">
            {/* Quick Action Buttons */}
            <div className="comms-quick-actions mb-3">
              <ButtonGroup size="sm">
                <Button color="primary" onClick={onStaffMessage}>
                  <FaComment className="me-1" />
                  New Staff Message
                </Button>
                <Button color="info" onClick={onFacultyMessage}>
                  <FaEnvelope className="me-1" />
                  Message Faculty
                </Button>
                <Button color="secondary" onClick={onAddNote}>
                  <FaStickyNote className="me-1" />
                  Quick Note
                </Button>
              </ButtonGroup>
            </div>

            {/* Communications Panel */}
            {submissionId ? (
              <>
                <div className="alert alert-info mb-3">
                  <small>
                    <strong>Showing communications for:</strong> Submission ID {submissionId}, Resource ID {item.id}
                  </small>
                </div>
                <CommunicationsPanel 
                  ref={commsPanelRef}
                  submissionId={submissionId} 
                  resourceId={item.id}
                />
              </>
            ) : (
              <div className="alert alert-warning">
                <strong>Unable to load communications</strong>
                <p className="mb-0">Submission ID not found. Item data: {JSON.stringify({
                  id: item.id,
                  submission_id: item.submission_id,
                  submission: item.submission
                }, null, 2)}</p>
              </div>
            )}
          </div>
        </TabPane>
      </TabContent>
    </div>
  );
};

ItemDetailsWithCommunications.propTypes = {
  item: PropTypes.object.isRequired,
  onStaffMessage: PropTypes.func.isRequired,
  onFacultyMessage: PropTypes.func.isRequired,
  onAddNote: PropTypes.func.isRequired,
  refreshTrigger: PropTypes.number
};

export default ItemDetailsWithCommunications;

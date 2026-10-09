import React from 'react';
import { Card, CardBody } from 'reactstrap';

/**
 * RecordSkeleton component 
 * 
 * @component
 * @description Provides a loading placeholder with animation for record cards.
 * This component renders a visual skeleton while the actual content is being loaded,
 * improving perceived performance and user experience.
 * @returns {JSX.Element} A skeleton UI card mimicking the structure of a record card
 */
const RecordSkeleton = React.memo(function RecordSkeleton() {
  return (
    <Card className="h-100 shadow-sm mb-4 position-relative overflow-hidden">
      <CardBody>
        <div className="d-flex justify-content-between mb-3">
          <div className="skeleton-badge" style={{ 
            width: '120px', 
            height: '24px', 
            borderRadius: '16px' 
          }}></div>
          <div className="skeleton-badge" style={{ 
            width: '80px', 
            height: '24px', 
            borderRadius: '4px' 
          }}></div>
        </div>
        
        <div className="skeleton-title" style={{ 
          width: '90%', 
          height: '32px', 
          marginBottom: '16px' 
        }}></div>
        
        <div className="d-flex mb-3">
          <div className="skeleton-badge" style={{ 
            width: '60px', 
            height: '28px', 
            borderRadius: '4px',
            marginRight: '12px'
          }}></div>
          <div className="skeleton-text" style={{ 
            width: '60%', 
            height: '28px'
          }}></div>
        </div>
        
        <div className="skeleton-text" style={{ 
          width: '100%', 
          height: '20px', 
          marginBottom: '10px' 
        }}></div>
        <div className="skeleton-text" style={{ 
          width: '90%', 
          height: '20px', 
          marginBottom: '10px' 
        }}></div>
        <div className="skeleton-text" style={{ 
          width: '80%', 
          height: '20px', 
          marginBottom: '30px' 
        }}></div>
        
        <div className="d-flex justify-content-between">
          <div className="skeleton-badge" style={{ 
            width: '100px', 
            height: '36px', 
            borderRadius: '4px' 
          }}></div>
          <div className="skeleton-badge" style={{ 
            width: '120px', 
            height: '36px', 
            borderRadius: '4px' 
          }}></div>
        </div>
      </CardBody>
    </Card>
  );
});

// PropTypes declaration (even for components with no props)
RecordSkeleton.propTypes = {};

export default RecordSkeleton;

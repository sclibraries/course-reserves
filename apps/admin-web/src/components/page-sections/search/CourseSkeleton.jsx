import { Card, CardBody } from 'reactstrap';

/**
 * CourseSkeleton component 
 * Provides a loading placeholder with animation for course cards
 */
function CourseSkeleton() {
  return (
    <Card className="h-100 shadow-sm mb-4 position-relative overflow-hidden">
      <CardBody>
        <div className="d-flex justify-content-between mb-3">
          <div className="skeleton-badge" style={{ width: '80px', height: '20px', borderRadius: '16px' }}></div>
          <div className="skeleton-badge" style={{ width: '60px', height: '20px', borderRadius: '16px' }}></div>
        </div>
        
        <div className="skeleton-title" style={{ width: '85%', height: '28px', marginBottom: '12px' }}></div>
        <div className="skeleton-subtitle" style={{ width: '70%', height: '20px', marginBottom: '20px' }}></div>
        
        <div className="skeleton-text" style={{ width: '100%', height: '14px', marginBottom: '8px' }}></div>
        <div className="skeleton-text" style={{ width: '80%', height: '14px', marginBottom: '32px' }}></div>
        
        <div className="skeleton-button position-absolute" style={{ 
          width: '120px', 
          height: '36px', 
          right: '16px', 
          bottom: '16px', 
          borderRadius: '4px' 
        }}></div>
      </CardBody>
    </Card>
  );
}

export default CourseSkeleton;

import { Badge } from 'reactstrap';

export const getVisibilityBadge = (visibility) => {
  switch (visibility) {
    case 'faculty_visible': return <Badge color="primary">Faculty Visible</Badge>;
    case 'staff_only': return <Badge color="secondary">Staff Only</Badge>;
    case 'all_staff': return <Badge color="info">All Staff</Badge>;
    case 'assigned_only': return <Badge color="warning">Assigned Only</Badge>;
    default: return null;
  }
};

import { useLocation } from 'react-router-dom';
import { useProxyAccessGrants } from '@/hooks/useProxyAccessGrants';

const OffDashboardGrantSync = () => {
  useProxyAccessGrants({ loadCourses: false });
  return null;
};

export const ProxyAccessSync = () => {
  const isDashboard = useLocation().pathname === '/';
  return isDashboard ? null : <OffDashboardGrantSync />;
};

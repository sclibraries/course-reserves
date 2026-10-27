import { Outlet } from 'react-router-dom';
import AdminNavigationSidebar from './admin-nav/AdminNavigationSidebar';
import { useAdminNavigation } from '../../hooks/admin/useAdminNavigation';

export default function AdminLayout() {
  const navigation = useAdminNavigation();

  return (
    <div className="tw-flex tw-min-w-0 tw-flex-col md:tw-flex-row">
      <AdminNavigationSidebar navigation={navigation} />
      <div className="tw-min-w-0 tw-flex-1 tw-px-4 tw-py-3">
        <Outlet context={navigation} />
      </div>
    </div>
  );
}

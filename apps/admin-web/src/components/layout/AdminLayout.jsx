import { Outlet, useLocation } from 'react-router-dom';
import AdminNavigationSidebar from './admin-nav/AdminNavigationSidebar';
import { useAdminNavigation } from '../../hooks/admin/useAdminNavigation';
import { getAdminNavigationRouteSettings } from '../../hooks/admin/useAdminNavigation';
import { ADMIN_HEADER_HEIGHT_STYLE } from './adminLayoutConstants';

export default function AdminLayout() {
  const navigation = useAdminNavigation();
  const { pathname } = useLocation();
  const { mutedBackground } = getAdminNavigationRouteSettings(pathname);

  return (
    <div className="tw-flex tw-min-w-0 tw-flex-col md:tw-flex-row">
      <AdminNavigationSidebar navigation={navigation} />
      <div
        data-testid="admin-layout-content"
        className={`tw-min-h-[calc(100vh-var(--admin-header-height))] tw-min-w-0 tw-flex-1 tw-px-4 tw-py-3 ${mutedBackground ? 'tw-bg-muted' : ''}`}
        style={ADMIN_HEADER_HEIGHT_STYLE}
      >
        <Outlet context={navigation} />
      </div>
    </div>
  );
}

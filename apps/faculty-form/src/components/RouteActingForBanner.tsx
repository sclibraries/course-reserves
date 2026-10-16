import { useLocation } from 'react-router-dom';
import { ActingForBanner } from '@/components/ActingForBanner';
import { hasStickyHeader } from './stickyHeaderRoutes';

export const RouteActingForBanner = () => {
  const { pathname } = useLocation();
  return hasStickyHeader(pathname) ? null : <ActingForBanner />;
};

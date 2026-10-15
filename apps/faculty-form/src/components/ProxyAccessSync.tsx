import { useLocation } from 'react-router-dom';
import { ProxyAccessSelector } from '@/components/ProxyAccessSelector';

export const ProxyAccessSync = () => {
  const location = useLocation();
  return location.pathname === '/' ? null : <ProxyAccessSelector renderSelector={false} />;
};

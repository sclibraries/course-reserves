import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { BookOpen, LogOut } from 'lucide-react';
import { ProxyAccessSelector } from '@/components/ProxyAccessSelector';
import StickyTop from '@/components/StickyTop';
import type { User } from '@/store/authStore';

export const DashboardHeader = ({
  user,
  isAuthenticated,
  termsLoading,
  termName,
  onLogout,
}: {
  user: User | null;
  isAuthenticated: boolean;
  termsLoading: boolean;
  termName: string;
  onLogout: () => void;
}) => (
  <StickyTop
    header={(
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Course Reserves</h1>
              {isAuthenticated && user && <Badge variant="outline" className="text-xs">{user.full_name}</Badge>}
            </div>
            <div className="flex items-center gap-3">
              {termsLoading ? <Skeleton className="h-6 w-24" /> : <Badge variant="secondary" className="text-sm">{termName}</Badge>}
              {isAuthenticated && user?.role === 'faculty' && <Button asChild size="sm" variant="outline"><Link to="/designees">Manage designees</Link></Button>}
              {isAuthenticated && <ProxyAccessSelector />}
              {isAuthenticated && <Button variant="outline" size="sm" onClick={onLogout} className="flex items-center gap-2"><LogOut className="h-4 w-4" />Logout</Button>}
            </div>
          </div>
        </div>
      </header>
    )}
  />
);

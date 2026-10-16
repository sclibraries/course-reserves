import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StickyTop from '@/components/StickyTop';

export const CloneMatchingTestHeader = ({ onBack }: { onBack: () => void }) => (
  <StickyTop
    header={(
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Clone Matching Test</h1>
            </div>
            <Badge variant="secondary">Debug Mode</Badge>
          </div>
        </div>
      </header>
    )}
  />
);

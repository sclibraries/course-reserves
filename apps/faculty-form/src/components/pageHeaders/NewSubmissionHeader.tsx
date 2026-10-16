import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StickyTop from '@/components/StickyTop';

export const NewSubmissionHeader = ({ onBack }: { onBack: () => void }) => (
  <StickyTop
    header={(
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Create New Course Reserve</h1>
          </div>
        </div>
      </header>
    )}
  />
);

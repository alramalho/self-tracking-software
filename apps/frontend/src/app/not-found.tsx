import { Button } from '@/components/ui/button';
import { Home, Squirrel } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Squirrel className="w-24 h-24 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Oops. Page not found</h1>
          <p className="text-muted-foreground">
            How did you even get here?
          </p>
        </div>
        
        <div className="space-y-3">
          <Link href="/">
            <Button className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go back home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
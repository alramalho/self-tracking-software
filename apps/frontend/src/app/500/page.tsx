'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Home, AlertTriangle, RefreshCw } from 'lucide-react';

const ServerErrorPage: React.FC = () => {
  useEffect(() => {
    // Deliberately throw an uncaught error to trigger 500 behavior
    throw new Error('Intentional server error for testing purposes');
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Something went wrong</h1>
          <p className="text-muted-foreground">
            This page intentionally triggers an uncaught error for testing purposes.
          </p>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Link href="/">
            <Button className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go back home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ServerErrorPage;
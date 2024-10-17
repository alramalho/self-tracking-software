"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlansRenderer from "@/components/PlansRenderer";

const HomePage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Your Dashboard</h1>
      
      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        
        <TabsContent value="plans">
          <PlansRenderer />
        </TabsContent>
        
        <TabsContent value="timeline">
          <div className="text-center py-8">
            <p className="text-gray-600">Timeline view is coming soon!</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HomePage;

"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlansRenderer from "@/components/PlansRenderer";
import { useSession } from "@clerk/nextjs";
import Link from "next/link";

const HomePage: React.FC = () => {
  const { isSignedIn } = useSession();

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <h1 className="text-3xl font-light text-gray-800 mb-6">welcome to self.tracking.so</h1>
        <Link 
          href="/signin" 
          className="bg-black text-white font-normal py-2 px-6 rounded hover:bg-gray-800 transition-colors duration-200"
        >
          Sign in
        </Link>
      </div>
    );
  }

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

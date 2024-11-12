"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Smartphone,
  Apple,
  Share,
  PlusSquare,
  MoreVertical,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname } from "next/navigation";

const AppNotInstalledPage: React.FC = () => {
  const [isAppInstallModalOpen, setIsAppInstallModalOpen] = useState(true);
  const pathname = usePathname();
  const excludedRoutes = ["/signin", "/signup", "/join-plan", "/onboarding"];

  if (excludedRoutes.some(route => pathname.startsWith(route))) {
    return null;
  }

  return (
    <>
      {isAppInstallModalOpen && (
        <div className="h-screen w-screen absolute flex flex-col items-center justify-center px-4 z-50 bg-white overflow-hidden">
          <button
            onClick={() => setIsAppInstallModalOpen(false)}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <Smartphone className="w-16 h-16 mb-6 text-gray-600" />
          <h2 className="text-2xl font-semibold mb-4 text-center">
            Please install the App to see this page
          </h2>
          <p className="text-gray-600 text-center mb-8 max-w-md">
            This will also enhance your experience and allow you to access
            features like notifications.
          </p>

          <div className="w-full max-w-md">
            <Tabs defaultValue="ios" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ios">
                  <Apple size={16} className="inline mr-2" />
                  iPhone / iPad
                </TabsTrigger>
                <TabsTrigger value="android">
                  <Smartphone size={16} className="inline mr-2" />
                  Android
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="ios"
                className="bg-gray-50 p-4 rounded-lg mt-4"
              >
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>
                    Click on the <Share className="inline w-5 h-5" /> button
                  </li>
                  <li>
                    Scroll down and click on &quot;Add to Home Screen{" "}
                    <PlusSquare className="inline w-5 h-5" />
                    &quot;
                  </li>
                </ol>
              </TabsContent>
              <TabsContent
                value="android"
                className="bg-gray-50 p-4 rounded-lg mt-4"
              >
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>Open Chrome browser</li>
                  <li>
                    Tap the menu <MoreVertical className="inline w5 h-5" />
                  </li>
                  <li>
                    Tap &quot;Install app&quot; or &quot;Add to Home
                    screen&quot;
                  </li>
                  <li>Follow the prompts to install</li>
                </ol>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </>
  );
};

export default AppNotInstalledPage;

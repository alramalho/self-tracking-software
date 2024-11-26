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
import { usePathname } from "next/navigation";
import InstallPWATabs from "./InstallPWATabs";


const AppNotInstalledPage: React.FC = () => {
  const [isAppInstallModalOpen, setIsAppInstallModalOpen] = useState(true);
  const pathname = usePathname();
  const excludedRoutes = ["/signin", "/signup", "/join-plan", "/onboarding", "/join"];

  if (excludedRoutes.some((route) => pathname.startsWith(route))) {
    return null;
  }

  return (
    <>
      {isAppInstallModalOpen && (
        <div className="h-screen w-screen fixed flex z-[60] flex-col items-center justify-center px-4 bg-white overflow-hidden pointer-events-auto">
          <button
            onClick={() => setIsAppInstallModalOpen(false)}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 z-[51]"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <Smartphone className="w-16 h-16 mb-6 text-gray-600" />
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
            Please continue in the App
          </h2>
          <p className="text-gray-600 text-center mb-8 max-w-md">
            This will also enhance your experience and allow you to access
            features like notifications.
          </p>

          <div className="w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">
              To install, just follow these steps 👇
            </h2>
            <InstallPWATabs />
          </div>
        </div>
      )}
    </>
  );
};

export default AppNotInstalledPage;

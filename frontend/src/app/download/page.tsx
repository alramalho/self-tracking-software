import React from "react";
import InstallPWATabs from "@/components/InstallPWATabs";
import { Smartphone, X } from "lucide-react";

const DownloadPage: React.FC = () => {
  return (
  <div className="h-screen w-screen absolute flex z-[60] flex-col items-center justify-center px-4 bg-white overflow-hidden pointer-events-auto">
      <Smartphone className="w-16 h-16 mb-6 text-gray-600" />

      <div className="w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">
             To Download the app in
            </h2>
            <InstallPWATabs />
          </div>
    </div>
  );
};

export default DownloadPage;

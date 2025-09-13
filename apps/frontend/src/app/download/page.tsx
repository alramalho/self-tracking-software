import DownloadComponent from "@/components/DownloadComponent";
import React from "react";

const DownloadPage: React.FC = () => {
  return (
    <div className="h-full w-full absolute flex z-[10] flex-col items-center justify-center px-4 bg-white overflow-hidden pointer-events-auto z-[1000]">
      <DownloadComponent />
    </div>
  );
};

export default DownloadPage;

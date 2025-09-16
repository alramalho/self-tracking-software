import DownloadComponent from "@/components/DownloadComponent";
import React from "react";

type DownloadPageProps = {
  searchParams?: {
    instagram?: string;
    tikok?: string;
  };
};

const DownloadPage: React.FC<DownloadPageProps> = ({ searchParams }) => {
  const isInstagram = searchParams?.instagram === "true";
  const isTikok = searchParams?.tikok === "true";

  return (
    <div className="h-full w-full absolute flex z-[10] flex-col items-center justify-center px-4 bg-white overflow-hidden pointer-events-auto z-[1000]">
      <DownloadComponent isInstagram={isInstagram} isTikok={isTikok} />
    </div>
  );
};

export default DownloadPage;

import DownloadComponent from "@/components/DownloadComponent";
import React from "react";

type DownloadPageProps = {
  searchParams?: {
    instagram?: string;
    tiktok?: string;
  };
};

const DownloadPage: React.FC<DownloadPageProps> = ({ searchParams }) => {
  const isInstagram = searchParams?.instagram === "true";
  const isTikTok = searchParams?.tiktok === "true";

  return (
    <div className="h-full w-full absolute flex z-[10] flex-col items-center justify-center px-4 bg-white overflow-hidden pointer-events-auto z-[1000]">
      <DownloadComponent isInstagram={isInstagram} isTikTok={isTikTok} />
    </div>
  );
};

export default DownloadPage;

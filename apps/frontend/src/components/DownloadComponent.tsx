"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import {
  Check,
  Copy,
  MoreVertical,
  MoveRight,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui/button";

const DownloadComponent = () => {
  const { shareOrCopyLink, isShareSupported } = useShareOrCopy();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isChrome =
    /Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent);
  const isSafari =
    /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent);
  const isSupportedBrowser = isChrome || isSafari;

  useEffect(() => {
    if (isDesktop) {
      window.location.href = "https://app.tracking.so/download";
    }
  }, [isDesktop]);

  useEffect(() => {
    console.log("isIOS", isIOS);
  }, [isIOS]);

  // Desktop users: redirect to mobile
  if (isDesktop) {
    return (
      <div className="flex flex-col gap-2 items-center">
        <div className="flex flex-row gap-2">
          <MoveRight className="w-16 h-16 mb-6 text-gray-600" />
          <Smartphone className="w-16 h-16 mb-6 text-gray-600" />
        </div>
        <h2 className="text-xl font-semibold text-center">
          Open this website on your mobile phone
        </h2>
        <span className="text-xl text-center text-gray-500 my-2 font-mono">
          tracking.so/download
        </span>
        <Button
          className="w-fit mx-auto"
          onClick={() => shareOrCopyLink(`https://app.tracking.so/download`)}
        >
          {isShareSupported ? "Share" : "Copy"} link
        </Button>
      </div>
    );
  }

  // Mobile users: check browser support
  if (!isSupportedBrowser) {
    return (
      <div className="flex flex-col gap-4 items-center text-center">
        <div className="flex flex-row gap-2">
          <X className="w-16 h-16 mb-2 text-gray-600" />
          <MoveRight className="w-16 h-16 mb-2 text-gray-600" />
          <Smartphone className="w-16 h-16 mb-2 text-gray-600" />
        </div>
        <div className="text-gray-600 mb-2">
          Current browser doesn&apos;t support app installation
        </div>
        <div className="text-gray-600 mb-4">You can still open this link</div>
        <div 
          className="bg-gray-900 p-3 px-7 rounded-lg border border-gray-700 flex items-center gap-2 mb-4 cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            shareOrCopyLink(`https://app.tracking.so/download`);
          }}
        >
          <span className="font-mono text-gray-100">tracking.so</span>
          <Copy className="w-6 h-6 text-gray-300" />
        </div>
        <div className="text-gray-600">in Chrome or Safari to install</div>
      </div>
    );
  }
  // Supported browser: show installation instructions
  return (
    <div className="flex flex-col gap-4 items-center text-center">
      <div className="flex flex-row gap-2">
        <Check className="w-16 h-16 mb-2 text-gray-600" />
        <MoveRight className="w-16 h-16 mb-2 text-gray-600" />
        <Smartphone className="w-16 h-16 mb-2 text-gray-600" />
      </div>
      <h2 className="text-2xl font-semibold mb-4">Install the App</h2>

      <div className="bg-gray-50 p-4 rounded-lg w-full max-w-md">
        <div className="space-y-3 text-left text-gray-600">
          {isIOS ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Share className="w-6 h-6 text-gray-600" />
                </div>
                <span>Tap the share button</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <PlusSquare className="w-6 h-6 text-gray-600" />
                </div>
                <span>
                  Scroll down and tap &quot;
                  <span className="font-semibold">Add to Home Screen</span>&quot;
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <MoreVertical className="w-6 h-6 text-gray-600" />
                </div>
                <span>Tap the menu button</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <PlusSquare className="w-6 h-6 text-gray-600" />
                </div>
                <span>
                  Look for &quot;
                  <span className="font-semibold">Add to Home Screen</span>
                  &quot; or &quot;
                  <span className="font-semibold">Install</span>
                  &quot;
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadComponent;

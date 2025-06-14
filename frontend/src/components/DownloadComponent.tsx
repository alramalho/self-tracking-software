"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClipboard } from "@/hooks/useClipboard";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useShare } from "@/hooks/useShare";
import {
  Apple,
  ArrowRight,
  MoreVertical,
  MoveRight,
  PlusSquare,
  Share,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

const DownloadComponent = () => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [copied, copyToClipboard] = useClipboard();
  const { share, isSupported: isShareSupported } = useShare();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleCopyLink = async (link: string) => {
    if (isShareSupported) {
      const success = await share(link);
      if (!success) throw new Error("Failed to share");
    } else {
      const success = await copyToClipboard(link);
      if (!success) throw new Error("Failed to copy");
      toast.success("Link copied to clipboard");
    }
  };

  if (!isDesktop)
    return (
      <div className="flex flex-col gap-2 items-center">
        <div className="flex flex-row gap-2">
          <MoveRight className="w-16 h-16 mb-6 text-gray-600" />
          <Smartphone className="w-16 h-16 mb-6 text-gray-600" />
        </div>
        <h2 className="text-xl font-semibold text-center">
          Firstly you&apos;ll need to open this website in your mobile phone
        </h2>
        <span className="text-xl text-center text-gray-500 my-2 font-mono">
          tracking.so/download
        </span>
        <Button
          className="w-fit mx-auto"
          onClick={() => handleCopyLink(`https://app.tracking.so/download`)}
        >
          {isShareSupported ? "Share" : "Copy"} link
        </Button>
      </div>
    );

  return (
    <>
      <Smartphone className="w-16 h-16 mb-6 text-gray-600" />

      <div className="w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          To Download the app in
        </h2>
      </div>

      <Tabs defaultValue={isIOS ? "ios" : "android"} className="w-full max-w-md">
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
        <TabsContent value="ios" className="bg-gray-50 p-4 rounded-lg mt-4">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>
              Click on the <Share className="inline w-5 h-5" /> button
            </li>
            <li>
              Scroll down and click on &quot;
              <span className="font-semibold mr-2">Add to Home Screen</span>
              <PlusSquare className="inline w-5 h-5" />
              &quot;
            </li>
          </ol>
        </TabsContent>
        <TabsContent value="android" className="bg-gray-50 p-4 rounded-lg mt-4">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>
              Tap the menu <MoreVertical className="inline w5 h-5" />
            </li>
            <li>
              Look for &quot;
              <span className="font-semibold">Add to Home Screen</span>
              &quot; or &quot;
              <span className="font-semibold">Install</span>
              &quot;
            </li>
          </ol>
        </TabsContent>
      </Tabs>
    </>
  );
};

export default DownloadComponent;

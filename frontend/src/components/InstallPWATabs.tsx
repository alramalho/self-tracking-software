"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Apple, MoreVertical, PlusSquare, Share, Smartphone } from "lucide-react";

const InstallPWATabs = () => {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    return (
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
        <TabsContent value="ios" className="bg-gray-50 p-4 rounded-lg mt-4">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            {isDesktop && <li>
              Open this page in your iPhone
            </li>}
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
        <TabsContent value="android" className="bg-gray-50 p-4 rounded-lg mt-4">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            {isDesktop && <li>
              Open this page in your android
            </li>}
            <li>Open Chrome browser, and tap the menu <MoreVertical className="inline w5 h-5" />
            </li>
            <li>Look for &quot;Install app&quot; or &quot;Add to Home screen&quot;</li>
            <li>Follow the prompts to install</li>
          </ol>
        </TabsContent>
      </Tabs>
  );
};

export default InstallPWATabs;
    
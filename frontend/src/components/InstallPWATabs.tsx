import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Apple, MoreVertical, PlusSquare, Share, Smartphone } from "lucide-react";

const InstallPWATabs = () => {
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
            <li>Open Chrome browser</li>
            <li>
              Tap the menu <MoreVertical className="inline w5 h-5" />
            </li>
            <li>Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;</li>
            <li>Follow the prompts to install</li>
          </ol>
        </TabsContent>
      </Tabs>
  );
};

export default InstallPWATabs;
    
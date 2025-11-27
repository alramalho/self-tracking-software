import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import DownloadComponent from "../components/DownloadComponent";
import { Drawer, DrawerContent, DrawerTrigger } from "../components/ui/drawer";
import { Button } from "../components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { Iphone } from "../components/ui/iphone";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      instagram: search.instagram === "true",
      tiktok: search.tiktok === "true",
    };
  },
});

function DownloadPage() {
  const { instagram, tiktok } = Route.useSearch();
  const [open, setOpen] = useState(true);

  // Force dark mode on /download page
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");

    return () => {
      // Restore previous state on unmount
      if (!wasDark) {
        root.classList.remove("dark");
      }
    };
  }, []);

  return (
    <div className="h-full w-full absolute flex z-[10] flex-col items-center justify-center px-4 bg-background overflow-hidden pointer-events-auto z-[1000]">
      <div className="flex flex-col items-center gap-6 mb-8">
        <img
          src="/icons/icon-transparent.png"
          alt="Tracking Software"
          className="w-24 h-24"
        />

        <div className="flex flex-col items-center gap-2">
          <h2 className="font-zalando-expanded-black font-black italic text-2xl leading-none translate-y-0.5 opacity-80 mb-1">
            tracking so<span className="opacity-50">ftware</span>
          </h2>
          <p className="text-muted-foreground text-center max-w-sm mt-4">
            The all-in-one free habit and lifestyle tracker.
          </p>
        </div>
        <div className="flex flex-row gap-3 text-muted-foreground">
          <Smartphone className="w-6 h-6" />
          <Download className="w-6 h-6" />
        </div>
      </div>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button size="lg">View Installation Instructions</Button>
        </DrawerTrigger>
        <DrawerContent className="h-[95dvh]">
          <div className="flex flex-col items-center pb-6 gap-4">
            <div className="top-0 left-0 flex flex-row items-center gap-2 z-10">
              <img
                src="/icons/icon-transparent.png"
                alt="Tracking Software"
                className="w-12 h-12"
              />
              <h2 className="font-zalando-expanded-black font-black italic text-lg leading-none translate-y-0.5 opacity-80 mb-1">
                tracking so<span className="opacity-50">ftware</span>
              </h2>
            </div>
            <div className="relative w-72 h-72 overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0">
                <Iphone src="/images/screenshots/new-plans.png" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-transparent pointer-events-none" />
            </div>
          </div>
          <DownloadComponent isInstagram={instagram} isTikTok={tiktok} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

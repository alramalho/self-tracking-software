import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer";

interface AppleLikePopoverProps {
  onClose: () => void;
  children: React.ReactNode;
  unclosable?: boolean;
  className?: string;
  open?: boolean;
}

const AppleLikePopover: React.FC<AppleLikePopoverProps> = ({
  onClose,
  children,
  unclosable = false,
  className,
  open = false,
}) => {
  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className={`px-6 pb-4 ${className}`}>
        <div className="w-12 h-1 bg-gray-300 rounded mx-auto mb-6" />
        {!unclosable && (
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-[51]"
            >
              <X className="h-6 w-6" />
            </Button>
          </DrawerClose>
        )}
        {children}
      </DrawerContent>
    </Drawer>
  );
};

export default AppleLikePopover;
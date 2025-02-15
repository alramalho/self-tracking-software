import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerClose,
  DrawerTitle,
} from "@/components/ui/drawer";

interface AppleLikePopoverProps {
  onClose: () => void;
  children: React.ReactNode;
  unclosable?: boolean;
  className?: string;
  open?: boolean;
  title?: string;
}

const AppleLikePopover: React.FC<AppleLikePopoverProps> = ({
  onClose,
  children,
  unclosable = false,
  className,
  open = false,
  title = "Content",
}) => {
  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className={`px-4 pb-4 ${className}`}>
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {!unclosable && (
          <DrawerClose asChild>
            <Button
              data-testid="close-popover"
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
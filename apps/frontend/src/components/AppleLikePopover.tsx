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
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";

interface AppleLikePopoverProps {
  onClose: () => void;
  children: React.ReactNode;
  unclosable?: boolean;
  className?: string;
  open?: boolean;
  title?: string;
  displayIcon?: boolean;
}

const AppleLikePopover: React.FC<AppleLikePopoverProps> = ({
  onClose,
  children,
  unclosable = false,
  className,
  open = false,
  title = "Content",
  displayIcon = true,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <div className="max-w-lg mx-auto">
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
          <DialogContent className={`px-4 pb-4 ${className}`}>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            {children}
          </DialogContent>
        </Dialog>
      </div>
    );
  } else {
    return (
      <div className="max-w-lg mx-auto">
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
          <DrawerContent className={`px-4 pb-4 ${className}`}>
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            {!unclosable && displayIcon && (
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
      </div>
    );
  }
};

export default AppleLikePopover;

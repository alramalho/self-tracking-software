import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ThreeOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  title: string | React.ReactNode;
  description: string;
  saveText?: string;
  discardText?: string;
  cancelText?: string;
  isSaving?: boolean;
}

const ThreeOptionsDialogOrPopover: React.FC<ThreeOptionsDialogProps> = ({
  isOpen,
  onClose,
  onDiscard,
  onSave,
  title,
  description,
  saveText = "Save",
  discardText = "Discard",
  cancelText = "Cancel",
  isSaving = false,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              {cancelText}
            </Button>
            <Button variant="destructive" onClick={onDiscard} disabled={isSaving}>
              {discardText}
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving..." : saveText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  } else {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="py-5">
              {cancelText}
            </Button>
            <Button variant="destructive" onClick={onDiscard} disabled={isSaving} className="py-5">
              {discardText}
            </Button>
            <Button onClick={onSave} disabled={isSaving} className="py-5">
              {isSaving ? "Saving..." : saveText}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }
};

export default ThreeOptionsDialogOrPopover;

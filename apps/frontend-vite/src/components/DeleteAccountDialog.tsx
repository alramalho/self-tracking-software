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
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useState } from "react";

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [confirmText, setConfirmText] = useState("");

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleConfirm = () => {
    if (confirmText.toLowerCase() === "delete") {
      onConfirm();
    }
  };

  const isConfirmDisabled = confirmText.toLowerCase() !== "delete" || isDeleting;

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              <span className="text-red-600 font-semibold">Warning: This action cannot be undone.</span>
              <br />
              This will <span className="font-semibold">permanently delete</span> your account and all associated data including:
              <ul className="list-disc ml-5 mt-2 text-sm">
                <li>Profile information</li>
                <li>Activities and entries</li>
                <li>Plans and progress</li>
                <li>Connections and messages</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Please type <span className="font-bold">delete</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full"
              disabled={isDeleting}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  } else {
    return (
      <Drawer open={isOpen} onOpenChange={handleClose}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete Account</DrawerTitle>
            <DrawerDescription>
              <span className="text-red-600 font-semibold">Warning: This action cannot be undone.</span>
              <br />
              This will <span className="font-semibold">permanently delete</span> your account and all associated data including:
              <ul className="list-disc ml-5 mt-2 text-sm">
                <li>Profile information</li>
                <li>Activities and entries</li>
                <li>Plans and progress</li>
                <li>Connections and messages</li>
              </ul>
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Please type <span className="font-bold">delete</span> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full"
              disabled={isDeleting}
            />
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }
};

export default DeleteAccountDialog;

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/contexts/users";
import { Pencil, User } from "lucide-react";
import { useState } from "react";
import { EditFullNamePopup, EditProfilePicturePopup } from "./EditFieldPopups";

interface EditProfileBannerProps {
  className?: string;
}

export function EditProfileBanner({ className }: EditProfileBannerProps) {
  const { currentUser } = useCurrentUser();
  const [showEditName, setShowEditName] = useState(false);
  const [showEditPicture, setShowEditPicture] = useState(false);

  return (
    <>
      <div
        className={`flex items-center gap-4 p-4 bg-muted/50 rounded-lg ${className || ""}`}
      >
        {/* Avatar with edit button */}
        <button
          type="button"
          onClick={() => setShowEditPicture(true)}
          className="relative group"
        >
          <Avatar className="h-16 w-16">
            <AvatarImage src={currentUser?.picture || undefined} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 flex items-center justify-center bg-background border border-border rounded-full p-1.5 shadow-sm">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </div>
        </button>

        {/* Name with edit button */}
        <div className="flex-1">
          <button
            type="button"
            onClick={() => setShowEditName(true)}
            className="flex items-center gap-2 group text-left"
          >
            <p className="font-semibold text-lg group-hover:underline">
              {currentUser?.name || "No name set"}
            </p>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <p className="text-sm text-muted-foreground">
            Click to edit your profile
          </p>
        </div>
      </div>

      {/* Edit Popups */}
      <EditFullNamePopup
        open={showEditName}
        onClose={() => setShowEditName(false)}
      />
      <EditProfilePicturePopup
        open={showEditPicture}
        onClose={() => setShowEditPicture(false)}
      />
    </>
  );
}

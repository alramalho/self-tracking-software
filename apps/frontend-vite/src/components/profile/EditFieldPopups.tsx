import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhotoUploader from "@/components/ui/PhotoUploader";
import { Switch } from "@/components/ui/switch";
import { useSupabaseUser } from "@/contexts/auth/provider";
import { useCurrentUser } from "@/contexts/users";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { twMerge } from "tailwind-merge";
import NumberInput from "../NumberInput";

interface EditFieldPopupProps {
  open: boolean;
  onClose: () => void;
}

export const EditLookingForApPopup: React.FC<
  EditFieldPopupProps & {
    currentValue: boolean;
  }
> = ({ open, onClose, currentValue }) => {
  const [value, setValue] = useState(currentValue);
  const { updateUser } = useCurrentUser();

  return (
    <AppleLikePopover
      open={open}
      onClose={onClose}
      title="Looking for Accountability Partner"
    >
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">
          Looking for Accountability Partner
        </h3>
        <p className="text-sm text-gray-600">
          This will make your profile discoverable and allow us to recommend
          your profile to people also looking for AP&apos;s.
        </p>
        <div className="flex items-center gap-3">
          <Switch checked={value} onCheckedChange={setValue} />
          <span
            className={twMerge(
              "text-sm",
              value ? "text-green-600" : "text-gray-500"
            )}
          >
            {value ? "Yes, I'm looking for an AP" : "No, not looking for an AP"}
          </span>
        </div>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateUser({
                updates: { lookingForAp: value },
                muteNotifications: true,
              });
            }}
            className="flex-1"
          >
            Save
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
};

export const EditAgePopup: React.FC<
  EditFieldPopupProps & {
    currentValue: number | null;
  }
> = ({ open, onClose, currentValue }) => {
  const [age, setAge] = useState(currentValue || 18);
  const { updateUser } = useCurrentUser();

  const handleSave = async () => {
    try {
      await updateUser({
        updates: { age },
        muteNotifications: true,
      });
      toast.success("Age updated");
      onClose();
    } catch (error) {
      toast.error("Failed to update age");
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Edit Age">
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">Select Your Age</h3>
        <div className="flex justify-center py-4">
          <NumberInput
            title="years old"
            value={age}
            onChange={setAge}
            min={12}
            max={100}
            tenIncrements
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
};

export const EditFullNamePopup: React.FC<EditFieldPopupProps> = ({
  open,
  onClose,
}) => {
  const { supabaseUser } = useSupabaseUser();
  const [firstName, setFirstName] = useState(supabaseUser?.user_metadata.firstName || "");
  const [lastName, setLastName] = useState(supabaseUser?.user_metadata.lastName || "");
  const { updateUser } = useCurrentUser();

  const handleSave = async () => {
    try {
      await updateUser({
        updates: {
          name: `${firstName} ${lastName}`,
        },
        muteNotifications: true,
      });
      toast.success("Name updated");
      onClose();
    } catch (error) {
      toast.error("Failed to update name");
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Edit Full Name">
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">Edit your full name</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter last name"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
};

export const EditProfilePicturePopup: React.FC<EditFieldPopupProps> = ({
  open,
  onClose,
}) => {
  const { currentUser, updateProfileImage, isUpdatingProfileImage } = useCurrentUser();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    try {
      await updateProfileImage(selectedFile);
      onClose();
    } catch (error) {
      console.error("Failed to update profile picture:", error);
    }
  };

  return (
    <AppleLikePopover
      open={open}
      onClose={onClose}
      title="Edit Profile Picture"
    >
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">Update Your Profile Picture</h3>
        <div className="flex justify-center py-4">
          <PhotoUploader
            onFileSelect={setSelectedFile}
            currentImageUrl={currentUser?.picture || undefined}
            placeholder="Upload new photo"
            disabled={isUpdatingProfileImage}
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isUpdatingProfileImage}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!selectedFile || isUpdatingProfileImage}
          >
            {isUpdatingProfileImage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </AppleLikePopover>
  );
};

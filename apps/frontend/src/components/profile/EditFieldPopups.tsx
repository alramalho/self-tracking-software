import { useApiWithAuth } from "@/api";
import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhotoUploader from "@/components/ui/PhotoUploader";
import { Switch } from "@/components/ui/switch";
import { WheelPicker, WheelPickerWrapper } from "@/components/ui/wheel-picker";
import { useCurrentUser } from "@/contexts/users";
import { useUser as useClerkUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { twMerge } from "tailwind-merge";

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
  const api = useApiWithAuth();

  const ageOptions = Array.from({ length: 83 }, (_, i) => ({
    value: (i + 18).toString(),
    label: (i + 18).toString(),
  }));

  const handleSave = async () => {
    try {
      await api.post("/users/update-user", {
        age: age,
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
          <WheelPickerWrapper>
            <WheelPicker
              options={ageOptions}
              value={age.toString()}
              onValueChange={(value: string) => setAge(parseInt(value))}
            />
          </WheelPickerWrapper>
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
  const { user: clerkUser } = useClerkUser();
  const [firstName, setFirstName] = useState(clerkUser?.firstName || "");
  const [lastName, setLastName] = useState(clerkUser?.lastName || "");
  const { updateUser } = useCurrentUser();

  const handleSave = async () => {
    try {
      await clerkUser?.update({
        firstName: firstName,
        lastName: lastName,
      });
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
  const { user: clerkUser } = useClerkUser();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { updateUser } = useCurrentUser();

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    setIsUploading(true);
    try {
      // Convert file to base64 for Clerk
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const result = await clerkUser?.setProfileImage({ file: base64 });
          const publicUrl = result?.publicUrl;
          if (!publicUrl) {
            toast.error("Failed to update profile picture");
            setIsUploading(false);
            return;
          }
          await updateUser({
            updates:{
              picture: publicUrl,
            },
            muteNotifications: true,
          });
          toast.success("Profile picture updated");
          onClose();
        } catch (error) {
          console.error("Failed to update profile picture:", error);
          toast.error("Failed to update profile picture");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast.error("Failed to update profile picture");
      setIsUploading(false);
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
            currentImageUrl={clerkUser?.imageUrl}
            placeholder="Upload new photo"
            disabled={isUploading}
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
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

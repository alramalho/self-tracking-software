import React, { useState } from 'react';
import { useApiWithAuth } from '@/api';
import { useUserPlan } from '@/contexts/UserPlanContext';
import { toast } from 'react-hot-toast';
import AppleLikePopover from './AppleLikePopover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useNotifications } from '@/hooks/useNotifications';

interface ActivityPhotoUploaderProps {
  activityData: {
    activityId: string;
    date: Date;
    quantity: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const ActivityPhotoUploader: React.FC<ActivityPhotoUploaderProps> = ({
  activityData,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublic, setisPublic] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { fetchUserData, setUserData, userData } = useUserPlan();
  const { addToNotificationCount } = useNotifications();
  const api = useApiWithAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const logActivity = async (withPhoto: boolean = false) => {
    setIsUploading(true);
    try {
      // First log the activity
      const response = await api.post("/log-activity", {
        activity_id: activityData.activityId,
        iso_date_string: activityData.date.toISOString(),
        quantity: activityData.quantity,
        has_photo: withPhoto,
      });

      if (!withPhoto) {
        // If no photo, we're done
        setUserData("me", {
          ...userData.me,
          activityEntries: [...userData.me.activityEntries, response.data],
        });
        toast.success("Activity logged successfully!");
        addToNotificationCount(1);
        onSuccess();
        return;
      }

      // If we have a photo, upload it
      if (selectedFile) {
        const formData = new FormData();
        formData.append('photo', selectedFile);
        formData.append('activityEntryId', response.data.id);
        formData.append('isPublic', isPublic.toString());

        await api.post('/store-activity-photo', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      fetchUserData();
      toast.success('Activity logged with photo successfully!');
      addToNotificationCount(1);
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to log activity. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppleLikePopover onClose={onClose} unclosable>
      <h2 className="text-2xl font-bold mb-4">📸 Add a proof!</h2>
      <p className="text-sm text-gray-500 mb-4">
        Only you and your friends can see this photo.
      </p>
      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
          onClick={() => document.getElementById('photo-input')?.click()}
        >
          {selectedFile ? (
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Selected"
              className="max-w-full h-auto mx-auto"
            />
          ) : (
            <div>
              <p className="text-gray-500">Click to upload a photo</p>
              <p className="text-sm text-gray-400">or drag and drop</p>
            </div>
          )}
        </div>
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {selectedFile && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-public"
              checked={isPublic}
              onCheckedChange={(checked) => setisPublic(checked as boolean)}
            />
            <label
              htmlFor="is-public"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Make public
            </label>
          </div>
        )}
        <Button 
          onClick={() => logActivity(!!selectedFile)} 
          className="w-full" 
          loading={isUploading}
        >
          {selectedFile ? 'Upload' : 'Log without photo'}
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
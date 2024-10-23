import React, { useState } from 'react';
import { useApiWithAuth } from '@/api';
import { useUserPlan } from '@/contexts/UserPlanContext';
import { toast } from 'react-hot-toast';
import AppleLikePopover from './AppleLikePopover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ActivityPhotoUploaderProps {
  activityEntry: any;
  onClose: () => void;
  onPhotoUploaded: () => void;
}

const ActivityPhotoUploader: React.FC<ActivityPhotoUploaderProps> = ({
  activityEntry,
  onClose,
  onPhotoUploaded,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [keepInProfile, setKeepInProfile] = useState(false);
  const { fetchUserData } = useUserPlan();
  const api = useApiWithAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a photo to upload');
      return;
    }

    const formData = new FormData();
    formData.append('photo', selectedFile);
    formData.append('activityEntryId', activityEntry.id);
    formData.append('keepInProfile', keepInProfile.toString());

    try {
      await api.post('/store-activity-photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      fetchUserData();

      toast.success('Photo uploaded successfully!');
      onPhotoUploaded();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo. Please try again.');
    }
  };

  return (
    <AppleLikePopover onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">📸 Add a proof!</h2>
      <p className="text-sm text-gray-500 mb-4">
        Only you and the people on a joint activity plan will see this photo.
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="keep-in-profile"
            checked={keepInProfile}
            onCheckedChange={(checked) => setKeepInProfile(checked as boolean)}
          />
          <label
            htmlFor="keep-in-profile"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Keep in profile
          </label>
        </div>
        <Button onClick={handleSubmit} className="w-full">
          Upload Photo
        </Button>
      </div>
    </AppleLikePopover>
  );
};

export default ActivityPhotoUploader;
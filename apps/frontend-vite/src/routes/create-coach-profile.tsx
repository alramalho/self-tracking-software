import { useApiWithAuth } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmojiInput } from "@/components/ui/emoji-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/contexts/users";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, User, Video, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/create-coach-profile")({
  component: CreateCoachProfilePage,
});

interface IdealPlan {
  emoji: string;
  title: string;
}

interface CoachDetails {
  title: string;
  bio?: string;
  focusDescription: string;
  idealPlans?: IdealPlan[];
  introVideoUrl?: string;
}

interface CoachProfile {
  id: string;
  type: "HUMAN";
  details: CoachDetails;
}

function CreateCoachProfilePage() {
  const api = useApiWithAuth();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();

  // Fetch existing coach profile
  const { data: existingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["my-coach-profile"],
    queryFn: async () => {
      try {
        const response = await api.get<CoachProfile>("/coaches/my-profile");
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null; // No profile exists yet
        }
        throw error;
      }
    },
  });

  const isEditMode = !!existingProfile;

  // Form state (name/picture come from user account, not editable here)
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [focusDescription, setFocusDescription] = useState("");
  const [idealPlans, setIdealPlans] = useState<IdealPlan[]>([
    { emoji: "🎯", title: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Pre-populate form with existing data
  useEffect(() => {
    if (existingProfile) {
      const details = existingProfile.details;
      setTitle(details.title || "");
      setBio(details.bio || "");
      setFocusDescription(details.focusDescription || "");
      setIdealPlans(
        details.idealPlans && details.idealPlans.length > 0
          ? details.idealPlans
          : [{ emoji: "🎯", title: "" }]
      );
      if (details.introVideoUrl) {
        setVideoPreviewUrl(details.introVideoUrl);
      }
    }
  }, [existingProfile]);

  const handleAddIdealPlan = () => {
    setIdealPlans([...idealPlans, { emoji: "🎯", title: "" }]);
  };

  const handleRemoveIdealPlan = (index: number) => {
    if (idealPlans.length > 1) {
      setIdealPlans(idealPlans.filter((_, i) => i !== index));
    }
  };

  const handleIdealPlanChange = (
    index: number,
    field: keyof IdealPlan,
    value: string
  ) => {
    const updated = [...idealPlans];
    updated[index][field] = value;
    setIdealPlans(updated);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be less than 100MB");
      return;
    }

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveVideo = () => {
    setVideoFile(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      toast.error("Please enter your coach title");
      return;
    }
    if (!bio.trim()) {
      toast.error("Please write a bio about yourself");
      return;
    }
    if (!focusDescription.trim()) {
      toast.error("Please describe what you specialize in");
      return;
    }
    const validPlans = idealPlans.filter((p) => p.title.trim());
    if (validPlans.length === 0) {
      toast.error("Please add at least one ideal plan type");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the coach profile first
      await api.post("/coaches/create-profile", {
        title: title.trim(),
        bio: bio.trim(),
        focusDescription: focusDescription.trim(),
        idealPlans: validPlans,
      });

      // Upload video if provided
      if (videoFile) {
        setIsUploadingVideo(true);
        const formData = new FormData();
        formData.append("video", videoFile);

        try {
          await api.post("/coaches/upload-video", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (videoError) {
          console.error("Failed to upload video:", videoError);
          toast.error("Profile created but video upload failed. You can add it later.");
        } finally {
          setIsUploadingVideo(false);
        }
      }

      toast.success(isEditMode ? "Coach profile updated successfully!" : "Coach profile created successfully!");
      navigate({ to: "/" });
    } catch (error: any) {
      console.error("Failed to save coach profile:", error);
      toast.error(
        error.response?.data?.error || "Failed to save coach profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      {/* Logo */}
      <div className="flex justify-start mb-6">
        <img
          src="/icons/icon-transparent.png"
          alt="tracking.so"
          className="h-16 w-16"
        />
      </div>

      <h1 className="text-2xl font-bold mb-2">
        {isLoadingProfile ? <Skeleton className="h-8 w-48" /> : isEditMode ? "Edit Coach Profile" : "Become a Coach"}
      </h1>
      <p className="text-muted-foreground mb-8">
        {isEditMode
          ? "Update your coach profile information."
          : "Create your coach profile to start helping others achieve their goals."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Info (read-only from user account) */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <Avatar className="h-16 w-16">
            <AvatarImage src={currentUser?.picture || undefined} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">{currentUser?.name || "No name set"}</p>
            <p className="text-sm text-muted-foreground">
              From your account profile
            </p>
          </div>
        </div>

        {/* Coach Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Coach Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Fitness Coach, Life Coach, Career Coach"
            required
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell potential clients about yourself, your background, and what makes you passionate about coaching..."
            rows={4}
            required
          />
        </div>

        {/* Introduction Video */}
        <div className="space-y-2">
          <Label>Introduction Video</Label>
          <p className="text-sm text-muted-foreground">
            Record a short video introducing yourself to potential clients (optional but recommended)
          </p>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />
          {videoPreviewUrl ? (
            <div className="relative rounded-lg overflow-hidden">
              <video
                src={videoPreviewUrl}
                controls
                className="w-full max-h-64 object-contain bg-black rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={handleRemoveVideo}
                className="absolute top-2 right-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => videoInputRef.current?.click()}
              className="w-full h-32 flex flex-col items-center justify-center gap-2 border-dashed"
            >
              <Video className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to upload video
              </span>
              <span className="text-xs text-muted-foreground">
                Max 100MB
              </span>
            </Button>
          )}
        </div>

        {/* Focus Description */}
        <div className="space-y-2">
          <Label htmlFor="focusDescription">What do you specialize in?</Label>
          <Textarea
            id="focusDescription"
            value={focusDescription}
            onChange={(e) => setFocusDescription(e.target.value)}
            placeholder="Describe your coaching focus in 1-2 sentences. E.g., 'I help busy professionals build sustainable fitness habits and achieve their body composition goals.'"
            rows={3}
            required
          />
        </div>

        {/* Ideal Plans */}
        <div className="space-y-3">
          <Label>Ideal Plan Types</Label>
          <p className="text-sm text-muted-foreground">
            What types of goals do you help clients achieve?
          </p>
          {idealPlans.map((plan, index) => (
            <div key={index} className="flex items-center gap-2">
              <EmojiInput
                value={plan.emoji}
                onChange={(value) =>
                  handleIdealPlanChange(index, "emoji", value)
                }
                className="w-16 text-center flex-shrink-0 text-2xl"
              />
              <Input
                value={plan.title}
                onChange={(e) =>
                  handleIdealPlanChange(index, "title", e.target.value)
                }
                placeholder="e.g., Lose weight, Run a marathon"
                className="flex-1 w-full"
              />
              {idealPlans.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveIdealPlan(index)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddIdealPlan}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add another plan type
          </Button>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting || isUploadingVideo || isLoadingProfile}
        >
          {isSubmitting || isUploadingVideo ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isUploadingVideo ? "Uploading Video..." : isEditMode ? "Updating Profile..." : "Creating Profile..."}
            </>
          ) : (
            isEditMode ? "Update Coach Profile" : "Create Coach Profile"
          )}
        </Button>
      </form>
    </div>
  );
}

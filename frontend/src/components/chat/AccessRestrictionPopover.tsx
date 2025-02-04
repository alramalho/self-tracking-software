import React, { useState } from "react";
import { Brain, Bell, PlusSquare, MessageSquarePlus } from "lucide-react";
import AppleLikePopover from "@/components/AppleLikePopover";
import { ReferralProgress } from "./ReferralProgress";
import { Button } from "../ui/button";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { useUserPlan } from "@/contexts/UserPlanContext";

interface AccessRestrictionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  referredUsers: number;
  requiredReferrals: number;
  onShareReferral: () => void;
  onRequestAccess: () => void;
}

export const AccessRestrictionPopover: React.FC<
  AccessRestrictionPopoverProps
> = ({
  isOpen,
  onClose,
  onRequestAccess,
}) => {
  const api = useApiWithAuth();
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const email = userData?.user?.email || "";
  const [text, setText] = useState("I want to try the AI because");
  
  const requestAccess = async () => {
    await toast.promise(
      api.post("/report-feedback", {
        email,
        text,
        type: "feature_request",
      }),
      {
        loading: "Requesting access...",
        success: "Access request sent successfully!",
        error: "Failed to send access request",
      }
    );
    onRequestAccess();
  };

  return (
    <AppleLikePopover
      open={isOpen}
      className={`z-[10000] ${isOpen ? "" : "hidden"}`}
      onClose={onClose}
      unclosable={true}
    >
      <h1 className="text-2xl font-bold mb-4">howdy partner 🤠</h1>
      <p className="text-base text-gray-700 mb-4">
        It seems you&apos;re curious about our AI coach. Here&apos;s what it
        does:
      </p>

      <div className="space-y-4 mb-6">
        <div className="flex items-start space-x-3">
          <Brain className="w-10 h-10 text-blue-300 mt-1" />
          <div>
            <h3 className="font-medium">Mood & Emotion extraction</h3>
            <p className="text-sm text-gray-600">
              Automatically detects and tracks your emotional state from
              conversations
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <PlusSquare className="w-10 h-10 text-blue-300 mt-1" />
          <div>
            <h3 className="font-medium">Smart Activity Detection</h3>
            <p className="text-sm text-gray-600">
              Captures and logs activities automatically, even one-off events
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <Bell className="w-10 h-10 text-blue-300 mt-1" />
          <div>
            <h3 className="font-medium">Intelligent Notifications</h3>
            <p className="text-sm text-gray-600">
              Context-aware notification system that knows when to reach out
            </p>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Message</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg min-h-[120px] focus:outline-none focus:ring-2 focus:ring-gray-200"
          required
        />
      </div>
      <Button className="w-full hover:bg-blue-50" onClick={requestAccess}>
        <MessageSquarePlus className="w-4 h-4 mr-2" />
        Request Access
      </Button>
      {/* <ReferralProgress
        referredUsers={referredUsers}
        requiredReferrals={requiredReferrals}
        onShareReferral={onShareReferral}
        onRequestAccess={onRequestAccess}
      /> */}
    </AppleLikePopover>
  );
};

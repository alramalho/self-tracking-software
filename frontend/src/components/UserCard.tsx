import React, { useState } from "react";
import {
  Activity,
  ActivityEntry,
  ApiPlan,
  User,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import { posthog } from "posthog-js";
import { useApiWithAuth } from "@/api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { getThemeVariants } from "@/utils/theme";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import PlanStreak from "@/components/PlanStreak";
import { PulsatingCirclePill } from "@/components/ui/pulsating-circle-pill";
import { motion } from "framer-motion";

interface UserCardProps {
  user: User;
  score?: number;
  plan?: ApiPlan;
  plans?: ApiPlan[];
  activities?: Activity[];
  activityEntries?: ActivityEntry[];
  showFriendRequest?: boolean;
  showScore?: boolean;
  showStreaks?: boolean;
  className?: string;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  score = 0,
  plan,
  plans = [],
  activities = [],
  activityEntries = [],
  showFriendRequest = true,
  showScore = true,
  showStreaks = true,
  className = "",
}) => {
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData, isLoading: isLoadingUser } =
    useCurrentUserDataQuery();
  const currentUser = userData?.user;
  const isOwnUser = currentUser?.id === user.id;
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [message, setMessage] = useState("");
  const api = useApiWithAuth();
  const router = useRouter();
  const { effectiveTheme } = useTheme();
  const variants = getThemeVariants(effectiveTheme);
  const [activityTooltipOpen, setActivityTooltipOpen] = useState(true);

  const handleSendFriendRequest = async () => {
    try {
      setIsSendingRequest(true);
      posthog.capture("ap_friend_request_sent", {
        sent_from_user_id: currentUser?.id,
        sent_from_user_username: currentUser?.username,
        sent_to_user_id: user.id,
        sent_to_user_username: user.username,
        message: message || undefined,
      });

      const payload: any = {};
      if (message.trim()) {
        payload.message = message.trim();
      }

      await api.post(`/send-friend-request/${user.id}`, payload);
      toast.success("Friend request sent successfully!");
      setMessage(""); // Clear message after sending
    } catch (error) {
      console.error("[UserCard] Error sending friend request:", error);
      toast.error("Failed to send friend request. Please try again.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleProfileClick = () => router.push(`/profile/${user.username}`);

  const hasProfilePicture = user.picture;

  // Common overlay components
  const CompatibilityBadge = () =>
    showScore && (
      <div className="absolute top-2 right-2">
        <div
          className={`inline-flex border border-white/20 backdrop-blur-sm items-center rounded-full px-3 py-1.5 text-sm shadow-md transition-all ${variants.card.glassBg}`}
        >
          <span className="text-gray-800 font-medium">
            {Math.round(score * 100)}% match
          </span>
        </div>
      </div>
    );

  const UserNameOverlay = () => (
    <div className="absolute bottom-2 left-2 right-2">
      <div
        className={`rounded-2xl overflow-hidden ${variants.card.glassBg} backdrop-blur-lg shadow-lg border border-white/20 p-3`}
      >
        <h3
          className="font-semibold text-lg text-gray-800 cursor-pointer"
          onClick={handleProfileClick}
        >
          {user.name || "Anonymous"}
        </h3>
        {user.username && (
          <p
            className="text-gray-600 text-sm cursor-pointer"
            onClick={handleProfileClick}
          >
            @{user.username}
          </p>
        )}
      </div>
    </div>
  );

  // Main content area based on profile picture availability
  const ProfileImageArea = () => (
    <div className="relative max-h-full max-w-full mx-auto p-4 pb-0">
      <div className="relative rounded-2xl overflow-hidden backdrop-blur-lg shadow-lg border border-white/20">
        {hasProfilePicture ? (
          <div
            className="w-full h-64 bg-gray-200 rounded-2xl overflow-hidden cursor-pointer"
            onClick={handleProfileClick}
          >
            <img
              src={user.picture}
              alt={user.name || "User"}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="w-full h-64 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center cursor-pointer"
            onClick={handleProfileClick}
          >
            <Avatar className="w-32 h-32">
              <AvatarFallback className="text-6xl text-gray-600">
                {(user.name || "U")[0]}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <CompatibilityBadge />
        <UserNameOverlay />
      </div>
    </div>
  );

  return (
    <div
      className={`bg-white/50 border rounded-lg overflow-hidden relative ${className}`}
    >
      <ProfileImageArea />

      <div className="p-4 flex flex-col space-y-4">
        {/* User stats */}
        <div className="space-y-2">
          {user.timezone && (
            <div className="flex items-center text-sm text-gray-600">
              <span>📍 {user.timezone.replace("_", " ")}</span>
            </div>
          )}

          <div className="flex items-center text-sm text-gray-600">
            {!user.last_active_at ? (
              <>
                <div
                  className="flex items-center gap-1 relative"
                  onClick={() => setActivityTooltipOpen((prev) => !prev)}
                >
                  <div className="mx-1">
                    <PulsatingCirclePill variant="yellow" size="md" />
                  </div>
                  <span className="italic">No recent activity</span>
                  {isOwnUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: activityTooltipOpen ? 1 : 0,
                        y: activityTooltipOpen ? 0 : 10,
                      }}
                      transition={{ duration: 0.2 }}
                      className="absolute bg-amber-400 text-gray-800 p-2 text-xs rounded-lg rounded-bl-none w-48 bottom-[10px] left-[20px] cursor-pointer"
                    >
                      <button>
                        <p>
                          Log an activity to rank higher
                          <br />
                          in the partner search!
                        </p>
                      </button>
                    </motion.div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mx-1 mr-2">
                  <PulsatingCirclePill variant="green" size="md" />
                </div>
                <span>
                  Last active{" "}
                  {formatDistanceToNow(
                    new Date(user.last_active_at || user.created_at!),
                    { addSuffix: true }
                  )}{" "}
                </span>
              </>
            )}
          </div>

          {user.profile && (
            <div className="mt-2">
              <p className="text-gray-700 text-sm line-clamp-3">
                {user.profile}
              </p>
            </div>
          )}

          {/* Show plans with streaks inline */}
          {plans.length > 0 && (
            <div className="mt-3 p-3 bg-gray-100/70 rounded-lg">
              <p className="text-gray-500 text-xs mb-2">Working on</p>
              <div className="space-y-2">
                {plans.slice(0, 3).map((planItem) => (
                  <div
                    key={planItem.id}
                    className="p-2 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        {planItem.emoji && (
                          <span className="text-2xl mr-2">
                            {planItem.emoji}
                          </span>
                        )}
                        <span className="font-semibold text-gray-800">
                          {planItem.goal}
                        </span>
                      </div>
                      {showStreaks && activities.length > 0 && (
                        <PlanStreak
                          plan={planItem}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback to single plan display if plans array is empty but plan prop exists */}
          {plans.length === 0 && plan && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-xs mb-1">Working on</p>
              <div className="flex items-center">
                {plan.emoji && (
                  <span className="text-2xl mr-2">{plan.emoji}</span>
                )}
                <span className="font-semibold text-gray-800">{plan.goal}</span>
              </div>
            </div>
          )}
        </div>

        {showFriendRequest && (
          <>
            {/* Message section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Message (optional)
              </label>
              <Textarea
                placeholder="Write a message to introduce yourself..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 text-right">
                {message.length}/500
              </div>
            </div>

            {/* Send friend request button */}
            <Button
              loading={isSendingRequest}
              disabled={isSendingRequest}
              className={`w-full rounded-xl p-5 ${variants.button.glass}`}
              onClick={handleSendFriendRequest}
            >
              <Send className="mr-2" />
              Send Friend Request
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default UserCard;

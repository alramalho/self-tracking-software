"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  Bell,
  ChartArea,
  Check,
  History,
  LogOut,
  Settings,
  UserPlus,
  X,
  Paintbrush,
  SquareArrowUp,
  Brain,
} from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-hot-toast";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  convertApiPlanToPlan,
  User,
  useUserPlan,
} from "@/contexts/UserPlanContext";
import {
  format,
  parseISO,
  differenceInDays,
  subDays,
  startOfWeek,
  isAfter,
  isBefore,
  addWeeks,
} from "date-fns";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useApiWithAuth } from "@/api";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import ActivityEntryEditor from "@/components/ActivityEntryEditor";
import PlanActivityEntriesRenderer from "@/components/PlanActivityEntriesRenderer";
import { usePostHog } from "posthog-js/react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Divider from "@/components/Divider";
import ActivityGridRenderer from "@/components/ActivityGridRenderer";
import { useShare } from "@/hooks/useShare";
import { useClipboard } from "@/hooks/useClipboard";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { isWeekCompleted } from "@/components/PlanActivityEntriesRenderer";
import { twMerge } from "tailwind-merge";
import { capitalize } from "lodash";
import { PlanBadge } from "@/components/PlanBadge";
import AISettings from "@/components/AISettings";
import ColorPalettePickerPopup from "@/components/profile/ColorPalettePickerPopup";

interface PlanStreak {
  emoji: string;
  score: number;
}

const ProfilePage: React.FC = () => {
  const { clearProfileNotifications } = useNotifications();
  const { signOut } = useClerk();
  const { isPushGranted, setIsPushGranted, requestPermission } =
    useNotifications();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const {
    useCurrentUserDataQuery,
    useUserDataQuery,
  } = useUserPlan();
  const currentUserQuery = useCurrentUserDataQuery();
  const params = useParams();
  const username = params.username as string;
  const currentUser = currentUserQuery.data?.user;
  const currentUserSentFriendRequests =
    currentUserQuery.data?.sentFriendRequests;
  const currentUserReceivedFriendRequests =
    currentUserQuery.data?.receivedFriendRequests;
  const profileDataQuery = useUserDataQuery(username);
  const profileData = profileDataQuery.data;
  const { activityEntries, activities } = profileData || {
    activityEntries: [],
    activities: [],
  };
  const api = useApiWithAuth();
  const [showEditActivityEntry, setShowEditActivityEntry] = useState<
    string | null
  >(null);
  const posthog = usePostHog();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [timeRange, setTimeRange] = useState<
    "60 Days" | "120 Days" | "180 Days"
  >("60 Days");
  const [endDate, setEndDate] = useState(new Date());
  const [showServerMessage, setShowServerMessage] = useState(false);
  const { share, isSupported: isShareSupported } = useShare();
  const [copied, copyToClipboard] = useClipboard();
  const isOnesOwnProfile = currentUser?.id === profileData?.user?.id;
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showStreakDetails, setShowStreakDetails] = useState(false);

  const { userPaidPlanType } = usePaidPlan();
  const userHasAccessToAi = userPaidPlanType === "supporter";
  const { setShowUpgradePopover } = useUpgrade();

  useEffect(() => {
    if (currentUser?.username && !username) {
      window.history.replaceState(null, "", `/profile/${currentUser.username}`);
    }
  }, [currentUser?.username, username]);

  useEffect(() => {
    if (!profileData) {
      isOnesOwnProfile
        ? currentUserQuery.refetch()
        : profileDataQuery.refetch();
    }
  }, [username, currentUserQuery, isOnesOwnProfile, profileDataQuery]);

  useEffect(() => {
    if (isOnesOwnProfile) {
      clearProfileNotifications();
    }
  }, [isOnesOwnProfile, clearProfileNotifications]);

  const handleNotificationChange = async (checked: boolean) => {
    if (checked) {
      if (!isPushGranted) {
        try {
          await requestPermission();
          toast.success("Permission for push notifications was granted");
        } catch (error) {
          toast.error("Failed to request permission for push notifications");
          console.error(
            "Failed to request permission for push notifications:",
            error
          );
        }
      }
    } else {
      setIsPushGranted(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (profileData && profileData.user) {
      await toast.promise(
        (async () => {
          await api.post(`/send-friend-request/${profileData!.user!.id}`);
          await currentUserQuery.refetch();
        })(),
        {
          loading: "Sending friend request...",
          success: "Friend request sent successfully",
          error: "Failed to send friend request",
        }
      );
    }
  };

  const handleFriendRequest = async (action: "accept" | "reject") => {
    if (profileData && profileData.user) {
      const request = currentUserReceivedFriendRequests?.find(
        (req) =>
          req.sender_id === profileData.user?.id && req.status === "pending"
      );
      if (request) {
        await toast.promise(
          (async () => {
            await api.post(`${action}-friend-request/${request.id}`);
            await currentUserQuery.refetch();
          })(),
          {
            loading: `${action}ing friend request...`,
            success: `Friend request ${action}ed`,
            error: `Failed to ${action} friend request`,
          }
        );
      }
    }
  };

  const handleLogout = () => {
    signOut();
    posthog.reset();
  };

  const activitiesNotInPlans = useMemo(() => {
    const planActivityIds = new Set(
      profileData?.plans?.flatMap((plan) => plan.activity_ids) || []
    );

    // Filter activities that are not in plans AND have at least one activity entry
    return activities.filter(
      (activity) =>
        !planActivityIds.has(activity.id) &&
        activityEntries.some((entry) => entry.activity_id === activity.id)
    );
  }, [profileData?.plans, activities, activityEntries]);

  const handleTimeRangeChange = (
    value: "60 Days" | "120 Days" | "180 Days"
  ) => {
    setTimeRange(value);
    setEndDate(new Date());
    // Force a recalculation by closing and reopening the streak details if it's open
    if (showStreakDetails) {
      setShowStreakDetails(false);
      // Small delay to ensure the popover closes before reopening
      setTimeout(() => setShowStreakDetails(true), 100);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowServerMessage(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);



  const calculateWeekStreaks = (): PlanStreak[] => {
    if (!profileData?.plans) {
      return [];
    }

    const streaks: PlanStreak[] = [];

    // Calculate date range based on selected timeRange
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
    const daysToSubtract =
      timeRange === "60 Days" ? 60 : timeRange === "120 Days" ? 120 : 180;
    const rangeStartDate = subDays(now, daysToSubtract);

    profileData.plans.forEach((plan) => {
      // Filter activities and entries for this plan
      const planActivities = activities.filter(
        (activity) => plan.activity_ids?.includes(activity.id) ?? false
      );
      const planActivityEntries = activityEntries.filter(
        (entry) => plan.activity_ids?.includes(entry.activity_id) ?? false
      );

      // Start from the range start date or the earliest activity date, whichever is later
      let weekStart = startOfWeek(rangeStartDate, { weekStartsOn: 0 });

      if (planActivityEntries.length > 0) {
        const earliestActivityDate = new Date(
          Math.min(
            ...planActivityEntries.map((entry) =>
              new Date(entry.date).getTime()
            )
          )
        );

        if (isAfter(earliestActivityDate, weekStart)) {
          weekStart = startOfWeek(earliestActivityDate, { weekStartsOn: 0 });
        }
      }

      // Initialize plan score
      let planScore = 0;
      let weekCount = 0;
      let incompleteWeeks = 0;

      while (isBefore(weekStart, currentWeekStart)) {
        // Only check completed weeks
        weekCount++;
        const convertedPlan = convertApiPlanToPlan(plan, planActivities);

        // Only check weeks that fall within our time range
        if (
          isAfter(weekStart, rangeStartDate) ||
          format(weekStart, "yyyy-MM-dd") ===
            format(rangeStartDate, "yyyy-MM-dd")
        ) {
          const wasCompleted = isWeekCompleted(
            weekStart,
            convertedPlan,
            planActivityEntries
          );

          if (wasCompleted) {
            planScore += 1;
            incompleteWeeks = 0;
          } else {
            incompleteWeeks += 1;
            if (incompleteWeeks > 1) {
              planScore = Math.max(0, planScore - 1);
            }
          }
        }

        // Move to next week using date-fns addWeeks to handle DST correctly
        weekStart = addWeeks(weekStart, 1);
        if (
          format(weekStart, "yyyy-MM-dd") ===
          format(currentWeekStart, "yyyy-MM-dd")
        ) {
          break; // Stop if we've reached the current week
        }
      }

      streaks.push({
        emoji: plan.emoji || "💪",
        score: planScore,
      });
    });

    return streaks;
  };

  if (!profileData) {
    return <div>No profile data available.</div>;
  }

  const user = profileData.user;

  const getUsername = (user: User | null) => {
    return user?.username;
  };

  const hasPendingReceivedFriendRequest = () => {
    return currentUserReceivedFriendRequests?.some(
      (request) =>
        request.sender_id === profileData.user?.id &&
        request.status === "pending"
    );
  };

  const hasPendingSentFriendRequest = () => {
    return currentUserSentFriendRequests?.some(
      (request) =>
        request.recipient_id === profileData.user?.id &&
        request.status === "pending"
    );
  };

  const isFriend = () => {
    return currentUser?.friend_ids?.includes(profileData.user?.id || "");
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      <div className="w-full max-w-3xl">
        <div className="flex justify-around gap-3 items-center mb-3">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar
                className={twMerge(
                  "w-20 h-20",
                  userPaidPlanType !== "free" &&
                    "ring-2 ring-offset-2 ring-offset-white",
                  userPaidPlanType === "supporter" && "ring-indigo-500",
                  userPaidPlanType === "plus" && "ring-blue-500"
                )}
              >
                <AvatarImage src={user?.picture || ""} alt={user?.name || ""} />
                <AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback>
              </Avatar>
              {userPaidPlanType && userPaidPlanType !== "free" && (
                <div className="absolute -bottom-1 -right-1">
                  <PlanBadge planType={userPaidPlanType} size={28} />
                </div>
              )}
            </div>
          </div>
          {userPaidPlanType == "supporter" && !isOnesOwnProfile && (
            <>
              <div
                onClick={() => setShowUpgradePopover(true)}
                className="relative text-2xl font-bold flex items-center gap-1 ml-2"
              >
                <picture>
                  <source
                    srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f331/512.webp"
                    type="image/webp"
                  />
                  <img
                    src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f331/512.gif"
                    alt="🌱"
                    width="54"
                    height="54"
                  />
                </picture>
                <span className="absolute bottom-0 right-[50%] translate-x-[50%] text-lg font-cursive">
                  supporter
                </span>
              </div>
            </>
          )}
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6">
              <Link href={`/friends/${getUsername(user)}`}>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {user?.friend_ids?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500">Friends</p>
                </div>
              </Link>
            </div>
            {!isOnesOwnProfile && !isFriend() && (
              <>
              {hasPendingReceivedFriendRequest() ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      has sent you a friend request
                    </p>
                    <div className="flex space-x-6">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-green-600 bg-green-50"
                        onClick={() => handleFriendRequest("accept")}
                      >
                        <Check className="h-6 w-6" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 text-red-600 bg-red-50"
                        onClick={() => handleFriendRequest("reject")}
                      >
                        <X className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={handleSendFriendRequest}
                    disabled={hasPendingSentFriendRequest()}
                  >
                    {hasPendingSentFriendRequest() ? (
                      <>
                        <Check size={20} />
                        <span>Request Sent</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={20} />
                        <span>Add Friend</span>
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
          {isOnesOwnProfile && (
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="icon"
                className="border-none"
                onClick={async () => {
                  try {
                    const link = `https://app.tracking.so/join/${currentUserQuery.data?.user?.username}`;
                    if (isShareSupported) {
                      const success = await share(link);
                      if (!success) throw new Error("Failed to share");
                    } else {
                      const success = await copyToClipboard(link);
                      if (!success) throw new Error("Failed to copy");
                    }
                  } catch (error) {
                    console.error("Failed to copy link to clipboard");
                  }
                }}
              >
                <UserPlus size={24} />
              </Button>
              <div className="flex items-center space-x-1">
                <Bell size={20} />
                <Switch
                  checked={isPushGranted}
                  onCheckedChange={handleNotificationChange}
                />
              </div>
              <Settings
                size={24}
                className="cursor-pointer"
                onClick={() => setShowUserProfile(true)}
              />
              <Paintbrush
                size={24}
                className="cursor-pointer"
                onClick={() => setShowColorPalette(true)}
              />
            </div>
          )}
        </div>

        {isOnesOwnProfile && (
          <>
            <AppleLikePopover
              open={showUserProfile}
              onClose={() => setShowUserProfile(false)}
            >
              <div className="max-h-[80vh] overflow-y-auto mt-12 mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <span
                    className={twMerge(
                      "text-xl font-cursive flex items-center gap-2",
                      userPaidPlanType === "free"
                        ? "text-gray-500"
                        : userPaidPlanType === "plus"
                        ? "text-blue-500"
                        : "text-indigo-500"
                    )}
                  >
                    On {capitalize(userPaidPlanType || "free")} Plan
                    <SquareArrowUp
                      onClick={() => setShowUpgradePopover(true)}
                      size={20}
                      className="text-gray-800"
                    />
                  </span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full mb-4 flex items-center justify-between px-0"
                >
                  <div className="flex items-center gap-2">
                    <LogOut size={20} />
                    <span>Logout</span>
                  </div>
                </Button>
                <Accordion type="single" collapsible>
                  <AccordionItem value="user-settings" className="border-none">
                    <AccordionTrigger className="py-2 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Settings size={20} />
                        <span>User Settings</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <UserProfile routing={"hash"} />
                    </AccordionContent>
                  </AccordionItem>

                  {userHasAccessToAi && (
                    <AccordionItem value="ai-settings" className="border-none">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex items-center gap-2">
                        <Brain size={20} />
                        <span>AI Settings</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <AISettings/>
                    </AccordionContent>
                  </AccordionItem>
                  )}

                </Accordion>
              </div>
            </AppleLikePopover>

            <ColorPalettePickerPopup
              open={showColorPalette}
              onClose={() => setShowColorPalette(false)}
            />
          </>
        )}

        <div className="relative w-full mb-4">
          <div className="flex flex-wrap w-full justify-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
            {isOnesOwnProfile && userPaidPlanType == "supporter" && (
              <>
                <div
                  onClick={() => setShowUpgradePopover(true)}
                  className="relative text-2xl font-bold flex items-center gap-1 ml-2"
                >
                  <picture>
                    <source
                      srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f331/512.webp"
                      type="image/webp"
                    />
                    <img
                      src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f331/512.gif"
                      alt="🌱"
                      width="54"
                      height="54"
                    />
                  </picture>
                  <span className="absolute bottom-0 right-[50%] translate-x-[50%] text-lg font-cursive">
                    supporter
                  </span>
                </div>
              </>
            )}

            {isOnesOwnProfile &&
              calculateWeekStreaks().map((streak, index) => (
                <div
                  key={index}
                  className="relative text-2xl font-bold flex items-center gap-1"
                  onClick={() => setShowStreakDetails(true)}
                >
                  <div
                    className={streak.score === 0 ? "opacity-40 grayscale" : ""}
                  >
                    <picture>
                      <source
                        srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp"
                        type="image/webp"
                      />
                      <img
                        src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
                        alt="🔥"
                        width="50"
                        height="50"
                      />
                    </picture>
                    <Badge className="absolute bottom-0 right-[-10px]">
                      x{streak.score} {streak.emoji}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>

          <AppleLikePopover
            open={showStreakDetails}
            onClose={() => setShowStreakDetails(false)}
            title="Streak Details"
          >
            <div className="p-4 space-y-6">
              <h3 className="text-xl font-semibold mb-4">
                🔥 Streak Breakdown
              </h3>

              <div className="space-y-4">
                {profileData.plans?.map((plan) => {
                  // Filter activities and entries for this plan
                  const planActivities = activities.filter(
                    (activity) =>
                      plan.activity_ids?.includes(activity.id) ?? false
                  );
                  const planActivityEntries = activityEntries.filter(
                    (entry) =>
                      plan.activity_ids?.includes(entry.activity_id) ?? false
                  );

                  // Calculate score for this plan
                  const now = new Date();
                  const currentWeekStart = startOfWeek(now, {
                    weekStartsOn: 0,
                  });
                  const daysToSubtract =
                    timeRange === "60 Days"
                      ? 60
                      : timeRange === "120 Days"
                      ? 120
                      : 180;
                  const rangeStartDate = subDays(now, daysToSubtract);

                  let weekStart = startOfWeek(rangeStartDate, {
                    weekStartsOn: 0,
                  });
                  let planScore = 0;
                  let completedWeeks = 0;
                  let incompleteWeeks = 0;

                  while (weekStart < currentWeekStart) {
                    const convertedPlan = convertApiPlanToPlan(
                      plan,
                      planActivities
                    );
                    const wasCompleted = isWeekCompleted(
                      weekStart,
                      convertedPlan,
                      planActivityEntries
                    );

                    if (wasCompleted) {
                      planScore += 1;
                      completedWeeks += 1;
                      // Reset buffer when a week is completed
                      incompleteWeeks = 0;
                    } else {
                      incompleteWeeks += 1;
                      // Only decrease score if we've missed more than one week (buffer week)
                      if (incompleteWeeks > 1) {
                        planScore = Math.max(0, planScore - 1);
                      }
                    }

                    weekStart = new Date(
                      weekStart.getTime() + 7 * 24 * 60 * 60 * 1000
                    );
                  }

                  if (
                    planScore === 0 &&
                    completedWeeks === 0 &&
                    incompleteWeeks === 0
                  ) {
                    return null;
                  }

                  return (
                    <div
                      key={plan.id}
                      className="p-4 border rounded-lg bg-white/50"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{plan.emoji}</span>
                        <h4 className="font-medium">{plan.goal}</h4>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>• Completed weeks: {completedWeeks}</p>
                        <p>• Incomplete weeks: {incompleteWeeks}</p>
                        <p>• Current streak score: {planScore}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">
                  How streaks are calculated:
                </h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Each completed week adds +1 to your streak</li>
                  <li>• You have a 1-week buffer when you miss a week.</li>
                  <li>
                    • After the buffer week, each additional incomplete week
                    subtracts -1 from your streak
                  </li>
                  <li>• Streak score cannot go below 0</li>
                  <li>
                    • Current week is not counted (as it is still in progress)
                  </li>
                </ul>
                <br />
                <br />
                <p className="text-sm text-gray-600">
                  The goal of the streaks is to motivate you to keep consistent!
                  Without over-stressing or demotivating when you fail.
                  <br />
                  That&apos;s why you have a 1-week buffer when you miss a week
                  :) We all have off weeks!
                </p>
              </div>
            </div>
          </AppleLikePopover>
        </div>

        <Tabs defaultValue="plans" className="w-full mb-2">
          <TabsList className={`grid w-full h-13 bg-gray-100 grid-cols-2`}>
            <TabsTrigger value="plans">
              <div className="flex flex-row gap-2 py-[2px] items-center">
                <ChartArea size={22} />
                <span>Plans</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="history">
              <div className="flex flex-row gap-2 py-[2px] items-center">
                <History size={22} />
                <span>History</span>
              </div>
            </TabsTrigger>
            {/* {userHasAccessToAi && isOnesOwnProfile && (
              <TabsTrigger value="mood">
                <div className="flex flex-col items-center">
                  <SquareActivity size={22} />
                  <span>Mood</span>
                </div>
              </TabsTrigger>
            )} */}
          </TabsList>
          <TabsContent value="plans">
            <div className="space-y-4 mt-4">
              {profileData.plans?.map((plan) => (
                <div key={plan.id} className="p-4 border rounded-lg bg-white">
                  <div className="flex flex-row items-center gap-2 mb-4">
                    <span className="text-4xl">{plan.emoji}</span>
                    <h3 className="text-lg font-semibold">{plan.goal}</h3>
                  </div>
                  <PlanActivityEntriesRenderer
                    plan={convertApiPlanToPlan(plan, activities)}
                    activities={activities}
                    activityEntries={activityEntries}
                    startDate={subDays(
                      new Date(),
                      timeRange === "60 Days"
                        ? 60
                        : timeRange === "120 Days"
                        ? 120
                        : 180
                    )}
                  />
                </div>
              ))}
              {profileData.plans && profileData.plans.length > 0 && (
                <div className="flex flex-row gap-4 justify-between items-center">
                  <span className="text-sm text-gray-500">Time range</span>
                  <div className="flex self-center">
                  <select
                    className="p-2 border rounded-md font-medium text-gray-800"
                    value={timeRange}
                    onChange={(e) =>
                      handleTimeRangeChange(
                        e.target.value as "60 Days" | "120 Days" | "180 Days"
                      )
                    }
                  >
                    <option value="60 Days">Since 60 days ago</option>
                    <option value="120 Days">Since 120 days ago</option>
                    <option value="180 Days">Since 180 days ago</option>
                  </select>
                </div>
              </div>
              )}
              {(!profileData.plans || profileData.plans.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  You haven&apos;t created any plans yet.
                </div>
              )}
              {activitiesNotInPlans.length > 0 && (
                <>
                  <Divider className="w-full" text="Activities 👇" />
                  <ActivityGridRenderer
                    activities={activitiesNotInPlans}
                    activityEntries={activityEntries.filter((entry) =>
                      activitiesNotInPlans
                        .map((a) => a.id)
                        .includes(entry.activity_id)
                    )}
                    timeRange={timeRange}
                    endDate={endDate}
                  />
                </>
              )}
            </div>
          </TabsContent>
          <TabsContent value="history">
            {activityEntries?.length > 0 ? (
              <div className="space-y-4">
                {activityEntries
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((entry) => {
                    const activity = activities.find(
                      (a) => a.id === entry.activity_id
                    );
                    return (
                      <ActivityEntryPhotoCard
                        key={entry.id}
                        imageUrl={entry.image?.url}
                        activityEntryId={entry.id}
                        activityTitle={activity?.title || "Unknown Activity"}
                        activityEmoji={activity?.emoji || ""}
                        activityEntryQuantity={entry.quantity}
                        activityEntryReactions={entry.reactions || {}}
                        activityMeasure={activity?.measure || ""}
                        isoDate={entry.date}
                        description={entry.description}
                        daysUntilExpiration={
                          entry.image?.expires_at
                            ? differenceInDays(
                                parseISO(entry.image.expires_at!),
                                new Date()
                              )
                            : -1
                        }
                        hasImageExpired={
                          !entry.image?.expires_at ||
                          new Date(entry.image.expires_at!) < new Date()
                        }
                        userPicture={user?.picture}
                        userName={user?.name}
                        userUsername={user?.username}
                        editable={isOnesOwnProfile}
                        onEditClick={() => {
                          setShowEditActivityEntry(entry.id);
                        }}
                      />
                    );
                  })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                {activityEntries?.length === 0
                  ? "You haven't completed any activities yet."
                  : `${user?.name}'s ${activities.length} past activities photos have expired.`}
              </div>
            )}
          </TabsContent>
          {/* {userHasAccessToAi && isOnesOwnProfile && (
            <TabsContent value="mood">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-white">
                  <div className="flex flex-row items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold">
                      Emotional Profile ⭐️
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground">
                      <Link
                        href="https://github.com/alramalho/self-tracking-software"
                        className="underline"
                      >
                        We don&apos;t store your voice data
                      </Link>
                    </p>
                  </div>
                  <EmotionViewer messages={messagesData.data?.messages || []} />
                </div>
              </div>
            </TabsContent>
          )} */}
        </Tabs>
      </div>
      {showEditActivityEntry && isOnesOwnProfile && (
        <ActivityEntryEditor
          open={!!showEditActivityEntry}
          activityEntry={
            activityEntries.find((entry) => entry.id === showEditActivityEntry)!
          }
          onDelete={() => {
            profileDataQuery.refetch();
          }}
          onClose={() => setShowEditActivityEntry(null)}
        />
      )}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        description="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default ProfilePage;

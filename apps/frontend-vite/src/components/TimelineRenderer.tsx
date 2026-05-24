import { useApiWithAuth } from "@/api";
import ActivityEntryPhotoCard from "@/components/ActivityEntryPhotoCard";
import AchievementPostCard from "@/components/AchievementPostCard";
import { useActivities } from "@/contexts/activities/useActivities";
import { usePlans } from "@/contexts/plans";
import { useTimeline } from "@/contexts/timeline/useTimeline";
import { useCurrentUser } from "@/contexts/users";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotifications } from "@/hooks/useNotifications";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { type Activity, type PlanType } from "@tsw/prisma";
import { ArrowRight, Bell, Check, MessageCircle, RefreshCcw, Sparkles, Squirrel, User, Users } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import toast from "react-hot-toast";
import {
  type TimelineActivityEntry,
  type TimelineAchievementPost,
} from "@/contexts/timeline/service";

interface HumanCoach {
  id: string;
  ownerId: string;
  type: "HUMAN";
  details: {
    title: string;
    bio?: string;
    focusDescription: string;
  };
  owner: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

const TimelineRenderer: React.FC<{
  onOpenSearch: () => void;
  highlightActivityEntryId?: string;
}> = ({ onOpenSearch, highlightActivityEntryId }) => {
  const {
    timelineData,
    isLoadingTimeline,
    isFetchingNextTimelinePage,
    isFetchNextTimelinePageError,
    hasMoreTimeline,
    fetchNextTimelinePage,
  } = useTimeline();
  const { currentUser } = useCurrentUser();
  const { plans } = usePlans();
  const navigate = useNavigate();
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const { isAppInstalled, isPushGranted, requestPermission } =
    useNotifications();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isPartnerSectionCollapsed, setIsPartnerSectionCollapsed] =
    useLocalStorage<boolean>("partner-section-collapsed", false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { activities } = useActivities();
  const themeColors = useThemeColors();
  const api = useApiWithAuth();

  // Check if user has any coached plan
  const coachedPlan = useMemo(() =>
    plans?.find((plan: any) => plan.isCoached && !plan.deletedAt),
    [plans]
  );

  // Fetch coaches to get coach info for coached plans
  const { data: humanCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const response = await api.get<HumanCoach[]>("/coaches");
      return response.data;
    },
    enabled: !!(coachedPlan as any)?.coachId,
  });

  // Find the coach for the coached plan
  const planCoach = useMemo(() => {
    if (!humanCoaches || !(coachedPlan as any)?.coachId) return null;
    return humanCoaches.find((c) => c.id === (coachedPlan as any).coachId) || null;
  }, [humanCoaches, (coachedPlan as any)?.coachId]);
  const variants = getThemeVariants(themeColors.raw);

  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(
    null
  );
  const processedEntryIdRef = useRef<string | null>(null);
  const [collapsedEntries, setCollapsedEntries] = useState<Set<string>>(
    new Set()
  );
  const dividerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [dividerSeen, setDividerSeen] = useState(false);

  // Track when user last viewed timeline (localStorage for immediate UI, synced with DB)
  const [lastViewedTimelineAt, setLastViewedTimelineAt] = useLocalStorage<
    string | null
  >("last-viewed-timeline-at", null);

  // Sync from DB on mount (DB takes precedence for cross-device sync)
  const dbLastSeenTimelineAt = (currentUser as any)?.lastSeenTimelineAt as string | null | undefined;
  useEffect(() => {
    if (dbLastSeenTimelineAt) {
      const dbTimestamp = new Date(dbLastSeenTimelineAt).toISOString();
      // Only update localStorage if DB has a more recent timestamp
      if (!lastViewedTimelineAt || new Date(dbTimestamp) > new Date(lastViewedTimelineAt)) {
        setLastViewedTimelineAt(dbTimestamp);
      }
    }
  }, [dbLastSeenTimelineAt]);

  // Initialize collapsed state for entries without images
  useEffect(() => {
    if (timelineData?.recommendedActivityEntries) {
      const entriesWithoutImages = new Set(
        timelineData.recommendedActivityEntries
          .filter(
            (entry) =>
              !entry.imageUrl ||
              (entry.imageExpiresAt &&
                new Date(entry.imageExpiresAt) < new Date())
          )
          .map((entry) => entry.id)
      );
      setCollapsedEntries(entriesWithoutImages);
    }
  }, [timelineData?.recommendedActivityEntries]);

  const toggleEntryCollapse = (entryId: string) => {
    setCollapsedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (highlightActivityEntryId && timelineData?.recommendedActivityEntries) {
      // Skip if we've already processed this ID
      if (processedEntryIdRef.current === highlightActivityEntryId) {
        return;
      }

      const entryExists = timelineData.recommendedActivityEntries.some(
        (entry) => entry.id === highlightActivityEntryId
      );

      // Mark as processed
      processedEntryIdRef.current = highlightActivityEntryId;

      if (entryExists) {
        setTimeout(() => {
          const element = entryRefs.current.get(highlightActivityEntryId);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedEntryId(highlightActivityEntryId);

            setTimeout(() => {
              setHighlightedEntryId(null);
              navigate({ to: "/", search: {} });
              processedEntryIdRef.current = null;
            }, 2000);
          }
        }, 100);
      } else {
        toast("ℹ️ This activity is no longer visible in your timeline");
        // Clear the search param even if entry doesn't exist
        navigate({ to: "/", search: {} });
        processedEntryIdRef.current = null;
      }
    }
  }, [highlightActivityEntryId, timelineData, navigate]);

  const friends = useMemo(() => {
    return [
      ...(currentUser?.connectionsFrom
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.to) || []),
      ...(currentUser?.connectionsTo
        .filter((conn) => conn.status === "ACCEPTED")
        ?.map((conn) => conn.from) || []),
    ];
  }, [currentUser?.connectionsFrom, currentUser?.connectionsTo]);

  // Merge achievement posts with activity entries and sort by date
  type TimelineActivityGroup = {
    primary: TimelineActivityEntry;
    entries: TimelineActivityEntry[];
  };

  type TimelineItem =
    | { type: "activity"; data: TimelineActivityGroup }
    | { type: "achievement"; data: TimelineAchievementPost };

  const mergedTimelineItems = useMemo(() => {
    if (!timelineData) return [];

    const items: TimelineItem[] = [];
    const activityEntries = timelineData.recommendedActivityEntries || [];
    const entryById = new Map(activityEntries.map((entry) => [entry.id, entry]));
    const seenEntryIds = new Set<string>();

    // Add activity entries, collapsing visible entries from the same shared activity
    // into one card. This mirrors the multi-photo card instead of rendering
    // duplicate "with @..." cards back-to-back.
    activityEntries.forEach((entry) => {
      if (seenEntryIds.has(entry.id)) return;

      const sharedEntries = (entry as any).sharedActivityEntry?.sharedActivity?.entries || [];
      const visibleGroupEntries = sharedEntries
        .map((sharedEntry: any) => entryById.get(sharedEntry.activityEntryId))
        .filter(Boolean) as TimelineActivityEntry[];

      const entries = Array.from(
        new Map([entry, ...visibleGroupEntries].map((groupEntry) => [groupEntry.id, groupEntry])).values()
      ).sort((a, b) => {
        const timeDiff = new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      });

      entries.forEach((groupEntry) => seenEntryIds.add(groupEntry.id));
      items.push({ type: "activity", data: { primary: entries[0], entries } });
    });

    // Add achievement posts
    (timelineData.achievementPosts || []).forEach((post) => {
      items.push({ type: "achievement", data: post });
    });

    // Sort by date (newest first)
    items.sort((a, b) => {
      const dateA =
        a.type === "activity"
          ? new Date(a.data.primary.datetime)
          : new Date(a.data.createdAt);
      const dateB =
        b.type === "activity"
          ? new Date(b.data.primary.datetime)
          : new Date(b.data.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    return items;
  }, [timelineData]);

  const activityById = useMemo(() => {
    const map = new Map<string, Activity>();
    [...(timelineData?.recommendedActivities || []), ...activities].forEach(
      (activity) => {
        map.set(activity.id, activity);
      }
    );
    return map;
  }, [activities, timelineData?.recommendedActivities]);

  const userById = useMemo(() => {
    const map = new Map<string, any>();
    [...(timelineData?.recommendedUsers || []), currentUser]
      .filter(Boolean)
      .forEach((user: any) => {
        map.set(user.id, user);
      });
    return map;
  }, [currentUser, timelineData?.recommendedUsers]);

  const planProgressByUserAndActivity = useMemo(() => {
    const map = new Map<string, any[]>();

    (timelineData?.recommendedUsers || []).forEach((user) => {
      user.plans?.forEach((plan) => {
        plan.activities?.forEach((activity) => {
          const key = `${user.id}:${activity.id}`;
          const existing = map.get(key) || [];
          map.set(key, [...existing, plan.progress]);
        });
      });
    });

    return map;
  }, [timelineData?.recommendedUsers]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreTimeline || isFetchNextTimelinePageError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isFetchingNextTimelinePage) {
          fetchNextTimelinePage();
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [
    fetchNextTimelinePage,
    hasMoreTimeline,
    isFetchingNextTimelinePage,
    isFetchNextTimelinePageError,
  ]);

  // Check if there will be a divider shown (new posts exist AND we have a lastViewedTimelineAt)
  const willShowDivider = useMemo(() => {
    if (!lastViewedTimelineAt || !mergedTimelineItems.length) return false;
    const lastViewed = new Date(lastViewedTimelineAt);

    // Check if there are any items newer than lastViewed
    const hasNewItems = mergedTimelineItems.some((item) => {
      const itemDate =
        item.type === "activity"
          ? new Date(item.data.primary.datetime)
          : new Date(item.data.createdAt);
      return itemDate > lastViewed;
    });

    // Check if there are any items older than or equal to lastViewed (where divider would appear)
    const hasOldItems = mergedTimelineItems.some((item) => {
      const itemDate =
        item.type === "activity"
          ? new Date(item.data.primary.datetime)
          : new Date(item.data.createdAt);
      return itemDate <= lastViewed;
    });

    return hasNewItems && hasOldItems;
  }, [lastViewedTimelineAt, mergedTimelineItems]);

  // Count new items for badge display
  const newItemsCount = useMemo(() => {
    if (!lastViewedTimelineAt || !mergedTimelineItems.length) return 0;
    const lastViewed = new Date(lastViewedTimelineAt);
    return mergedTimelineItems.filter((item) => {
      const itemDate =
        item.type === "activity"
          ? new Date(item.data.primary.datetime)
          : new Date(item.data.createdAt);
      return itemDate > lastViewed;
    }).length;
  }, [lastViewedTimelineAt, mergedTimelineItems]);

  // Update last viewed timestamp when user views timeline
  // If divider exists: wait until user scrolls to it
  // If no divider: use 3-second fallback (first-time user or user who's seen everything)
  useEffect(() => {
    if (!timelineData?.recommendedActivityEntries?.length) return;

    const updateLastViewed = () => {
      const newestEntry = timelineData.recommendedActivityEntries[0];
      if (newestEntry?.datetime) {
        const newestDatetime = new Date(newestEntry.datetime).toISOString();
        console.log(
          "[Timeline] Updating lastViewedTimelineAt to:",
          newestDatetime
        );
        setLastViewedTimelineAt(newestDatetime);
        // Sync to DB for cross-device persistence (fire and forget)
        api.post("/users/update-timeline-seen", { lastSeenTimelineAt: newestDatetime }).catch((err) => {
          console.warn("[Timeline] Failed to sync lastSeenTimelineAt to DB:", err);
        });
      }
    };

    // If a divider will be shown, wait for user to scroll to it
    if (willShowDivider) {
      // Use IntersectionObserver to detect when divider is visible
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && !dividerSeen) {
            console.log("[Timeline] Divider seen, updating lastViewedTimelineAt");
            setDividerSeen(true);
            updateLastViewed();
            observer.disconnect();
          }
        },
        { threshold: 0.5 } // Trigger when 50% of divider is visible
      );

      // Small delay to ensure divider is rendered
      const setupTimer = setTimeout(() => {
        if (dividerRef.current) {
          observer.observe(dividerRef.current);
        }
      }, 100);

      return () => {
        clearTimeout(setupTimer);
        observer.disconnect();
      };
    } else {
      // No divider will be shown (first-time user or no new posts)
      // Fall back to 3-second timeout
      const timer = setTimeout(() => {
        updateLastViewed();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [timelineData?.recommendedActivityEntries, setLastViewedTimelineAt, willShowDivider, dividerSeen, api]);

  // Reset dividerSeen when timeline data changes significantly
  useEffect(() => {
    setDividerSeen(false);
  }, [timelineData?.recommendedActivityEntries?.length]);

  // Reorder entries to prevent grid breaks on mount
  // Group collapsed entries and full-width entries intelligently
  // Only reorder once on mount, not when collapse state changes
  // const reorderedEntries = useMemo(() => {
  //   if (!timelineData?.recommendedActivityEntries) return [];w-fit rounded-2xl p-3 px-4 max-w-full rounded-br-none bg-muted

  //   const entries = timelineData.recommendedActivityEntries;
  //   const result: typeof entries = [];
  //   const collapsed: typeof entries = [];
  //   const fullWidth: typeof entries = [];

  //   // Separate entries by type (using initial state - entries without images)
  //   entries.forEach((entry) => {
  //     const hasImageExpired =
  //       entry.imageExpiresAt && new Date(entry.imageExpiresAt) < new Date();
  //     const hasImage = entry.imageUrl && !hasImageExpired;

  //     if (!hasImage) {
  //       collapsed.push(entry);
  //     } else {
  //       fullWidth.push(entry);
  //     }
  //   });

  //   // Build result array
  //   // Add collapsed entries in groups of 3, then full-width entries
  //   let collapsedIndex = 0;
  //   let fullWidthIndex = 0;

  //   while (collapsedIndex < collapsed.length || fullWidthIndex < fullWidth.length) {
  //     // Add up to 3 collapsed entries
  //     const batchSize = Math.min(3, collapsed.length - collapsedIndex);
  //     for (let i = 0; i < batchSize; i++) {
  //       result.push(collapsed[collapsedIndex++]);
  //     }

  //     // Add one full-width entry if available
  //     if (fullWidthIndex < fullWidth.length) {
  //       result.push(fullWidth[fullWidthIndex++]);
  //     }
  //   }

  //   return result;
  // }, [timelineData?.recommendedActivityEntries]);

  // Divider component - Instagram style
  const AllCaughtUpDivider = React.forwardRef<HTMLDivElement>((_, ref) => (
    <div ref={ref} className="col-span-2 sm:col-span-4 flex items-center justify-center py-6">
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
          <Check className="w-6 h-6 text-muted-foreground" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold text-foreground">
          You're all caught up
        </span>
        <span className="text-xs text-muted-foreground">
          You've seen all new posts
        </span>
      </div>
    </div>
  ));

  if (isLoadingTimeline && !timelineData) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-card/50 backdrop-blur-sm border rounded-2xl overflow-hidden"
          >
            <div className="relative max-h-full max-w-full mx-auto p-4 pb-0">
              <div className="relative rounded-2xl overflow-hidden backdrop-blur-lg shadow-lg border border-white/20">
                <Skeleton className="w-full h-[300px] rounded-2xl" />
              </div>
            </div>
            <div className="p-4 flex flex-col flex-nowrap items-start justify-between">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex flex-col space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!friends?.length) {
    return (
      <div className="flex flex-col items-center gap-8 text-center pt-2">
        {/* Show Coach Card if user has coached plan, otherwise show Get Coached Banner */}
        {!coachedPlan && (
          <button
            onClick={() => navigate({ to: "/get-coached", search: { coach: "" } })}
            className="w-full rounded-2xl overflow-hidden relative group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-700" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="absolute inset-0 group-hover:bg-white/10 transition-colors" />
            <div className="relative p-4 text-white text-left">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-semibold">Need help getting started?</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/70">Get personalized coaching today</p>
                <ArrowRight className="w-4 h-4 text-white/70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        )}

        {/* Find Friends Section */}
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Squirrel className="w-20 h-20 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm text-muted-foreground">
              Add friends to see their activity here
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/search" })} className="mt-1">
            Find Friends
          </Button>
        </div>
      </div>
    );
  }

  if (
    timelineData?.recommendedActivityEntries.length === 0 &&
    (timelineData?.achievementPosts || []).length === 0
  ) {
    return (
      <div className="text-start text-muted-foreground pt-2">
        Your friends have not logged anything yet...
        <br />
        {isPushGranted ? (
          <span className="text-sm text-muted-foreground">
            Maybe you could go ahead and poke them?
          </span>
        ) : (
          <div className="flex flex-col items-start">
            <span className="text-sm text-muted-foreground">
              Turn on notifications to know when they do
            </span>
            <Button
              className="mt-3"
              onClick={() => {
                if (isDesktop || !isAppInstalled) {
                  navigate({
                    to: "/download",
                    search: { instagram: false, tiktok: false },
                  });
                } else {
                  requestPermission();
                }
              }}
            >
              <Bell className="w-4 h-4 mr-2" /> Turn on notifications
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={timelineRef} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="flex items-center justify-start gap-2 mt-4 col-span-2 sm:col-span-4">
        <Users size={18} className="text-muted-foreground" />
        <h2 className="mt-0 text-lg font-semibold">
          Friend&apos;s last activities
        </h2>
        <span className="text-sm text-muted-foreground">
          ({mergedTimelineItems.length})
        </span>
        {newItemsCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {newItemsCount} new
          </Badge>
        )}
        {isLoadingTimeline && (
          <RefreshCcw className="w-4 h-4 animate-spin" />
        )}
      </div>

      {!isLoadingTimeline &&
        timelineData?.recommendedActivities &&
        timelineData?.recommendedUsers &&
        (() => {
          let dividerShown = false;
          const lastViewed = lastViewedTimelineAt
            ? new Date(lastViewedTimelineAt)
            : null;

          // Check if there are any new items (newer than lastViewed)
          const hasNewEntries =
            lastViewed &&
            mergedTimelineItems.some((item) => {
              const itemDate =
                item.type === "activity"
                  ? new Date(item.data.primary.datetime)
                  : new Date(item.data.createdAt);
              return itemDate > lastViewed;
            });

          return mergedTimelineItems.map((item, index) => {
            if (item.type === "achievement") {
              // Render achievement post
              const post = item.data;

              // Check if we should show the divider before this post
              const postDatetime = new Date(post.createdAt);
              const shouldShowDivider =
                !dividerShown &&
                hasNewEntries &&
                lastViewed &&
                postDatetime <= lastViewed;

              if (shouldShowDivider) {
                dividerShown = true;
              }

              return (
                <React.Fragment key={`achievement-${post.id}`}>
                  {shouldShowDivider && <AllCaughtUpDivider ref={dividerRef} />}
                  <div className="col-span-2 sm:col-span-4">
                    <AchievementPostCard
                      achievementPost={post}
                      onAvatarClick={() => {
                        navigate({
                          to: `/profile/$username`,
                          params: { username: post.user.username || "" },
                        });
                      }}
                      onUsernameClick={() => {
                        navigate({
                          to: `/profile/$username`,
                          params: { username: post.user.username || "" },
                        });
                      }}
                    />
                  </div>
                </React.Fragment>
              );
            } else {
              // Render activity entry or merged joint-activity group
              const group = item.data;
              const entry = group.primary;
              const activity = entry.activityId
                ? activityById.get(entry.activityId)
                : undefined;
              const user = activity ? userById.get(activity.userId) : undefined;
              if (!activity || !user || user.username === null) return null;

              const sharedActivityEntries = group.entries
                .filter((groupEntry) => groupEntry.id !== entry.id)
                .map((groupEntry) => {
                  const groupActivity = groupEntry.activityId
                    ? activityById.get(groupEntry.activityId)
                    : undefined;
                  const groupUser = groupActivity
                    ? userById.get(groupActivity.userId)
                    : undefined;

                  if (!groupActivity || !groupUser || groupUser.username === null) {
                    return null;
                  }

                  return {
                    activityEntry: groupEntry as any,
                    activity: groupActivity,
                    user: groupUser as {
                      username: string;
                      name: string;
                      picture: string;
                      planType: PlanType;
                    },
                  };
                })
                .filter(Boolean) as {
                  activityEntry: TimelineActivityEntry;
                  activity: Activity;
                  user: { username: string; name: string; picture: string; planType: PlanType };
                }[];

              const userPlansProgress =
                planProgressByUserAndActivity.get(`${user.id}:${activity.id}`) ||
                [];

              const hasImage = group.entries.some((groupEntry) => {
                const hasImageExpired =
                  groupEntry.imageExpiresAt &&
                  new Date(groupEntry.imageExpiresAt) < new Date();
                const imageUrls = (groupEntry as any).imageUrls || [];
                return (groupEntry.imageUrl || imageUrls.length > 0) && !hasImageExpired;
              });
              const isCollapsed = group.entries.every((groupEntry) =>
                collapsedEntries.has(groupEntry.id)
              );
              const isHighlighted = group.entries.some(
                (groupEntry) => groupEntry.id === highlightedEntryId
              );

              // Check if we should show the divider before this entry
              const entryDatetime = new Date(entry.datetime);
              const shouldShowDivider =
                !dividerShown &&
                hasNewEntries &&
                lastViewed &&
                entryDatetime <= lastViewed;

              if (shouldShowDivider) {
                dividerShown = true;
              }

              return (
                <React.Fragment key={`activity-${entry.id}`}>
                  {shouldShowDivider && <AllCaughtUpDivider ref={dividerRef} />}
                  <div
                    ref={(el) => {
                      group.entries.forEach((groupEntry) => {
                        if (el) {
                          entryRefs.current.set(groupEntry.id, el);
                        } else {
                          entryRefs.current.delete(groupEntry.id);
                        }
                      });
                    }}
                    className={`transition-all duration-500 ${
                      isHighlighted
                        ? cn(
                            "ring-4 ring-opacity-50 rounded-2xl",
                            variants.ring
                          )
                        : ""
                    } ${
                      hasImage
                        ? "col-span-2 sm:col-span-4"
                        : isCollapsed
                        ? "col-span-1"
                        : "col-span-2 sm:col-span-4"
                    }`}
                  >
                    <ActivityEntryPhotoCard
                      key={entry.id}
                      activity={activity}
                      activityEntry={entry as any}
                      user={
                        user as {
                          username: string;
                          name: string;
                          picture: string;
                          planType: PlanType;
                        }
                      }
                      userPlansProgressData={userPlansProgress}
                      sharedActivityEntries={sharedActivityEntries}
                      isCollapsed={isCollapsed}
                      onToggleCollapse={() => toggleEntryCollapse(entry.id)}
                      onAvatarClick={() => {
                        navigate({
                          to: `/profile/$username`,
                          params: { username: user?.username || "" },
                        });
                      }}
                      onUsernameClick={() => {
                        navigate({
                          to: `/profile/$username`,
                          params: { username: user?.username || "" },
                        });
                      }}
                    />
                  </div>
                </React.Fragment>
              );
            }
          });
        })()}
      <div ref={loadMoreRef} className="col-span-2 sm:col-span-4 h-6" />
      {isFetchingNextTimelinePage && (
        <div className="col-span-2 sm:col-span-4 flex justify-center py-4">
          <RefreshCcw className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {isFetchNextTimelinePageError && !isFetchingNextTimelinePage && (
        <div className="col-span-2 sm:col-span-4 flex flex-col items-center gap-2 py-4 text-center text-xs text-muted-foreground">
          <span>Couldn&apos;t load more timeline items.</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => fetchNextTimelinePage()}
          >
            <RefreshCcw className="w-3 h-3 mr-2" /> Try again
          </Button>
        </div>
      )}
      {!hasMoreTimeline && !isFetchingNextTimelinePage && mergedTimelineItems.length > 0 && (
        <div className="col-span-2 sm:col-span-4 py-4 text-center text-xs text-muted-foreground">
          You&apos;re all caught up
        </div>
      )}
    </div>
  );
};

export default TimelineRenderer;

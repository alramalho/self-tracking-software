import { useDataNotifications } from "@/contexts/notifications";
import { useCurrentUser } from "@/contexts/users";
import { useLogError } from "@/hooks/useLogError";
import { useNotifications } from "@/hooks/useNotifications";
import { useThemeColors } from "@/hooks/useThemeColors";
import { formatTimeAgo } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { Link, useNavigate } from "@tanstack/react-router";
import { type Notification } from "@tsw/prisma";
import { Check, Eye, X } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Remark } from "react-remark";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";

interface NotificationItemProps {
  notification: Notification;
  markNotificationAsOpened: (notificationId: string) => void;
  handleNotificationAction: (notification: Notification, action: string) => void;
  renderActionButtons: (notification: Notification) => React.ReactNode;
  hasPictureData: (notification: Notification) => boolean;
  hasUsernameData: (notification: Notification) => boolean;
  onClose?: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  markNotificationAsOpened,
  handleNotificationAction,
  renderActionButtons,
  hasPictureData,
  hasUsernameData,
  onClose,
}) => {
  const { ref, inView } = useInView({
    threshold: 0.5,
    triggerOnce: true,
  });

  const relatedData = notification.relatedData as {
    username?: string;
    picture?: string;
    name?: string;
    activityEntryId?: string;
    commenterUsername?: string;
    reactorUsername?: string;
    userUsername?: string;
  };

  const isUnopened = notification.status !== "OPENED" && notification.status !== "CONCLUDED";

  // Determine navigation target - activity entry or user profile
  const getNavigationProps = () => {
    if (relatedData?.activityEntryId) {
      // Navigate to timeline with activity entry ID as search param
      return {
        to: "/" as const,
        search: { activityEntryId: relatedData.activityEntryId },
      };
    }
    // Fallback to profile navigation
    const username = relatedData?.username || relatedData?.commenterUsername || relatedData?.reactorUsername || relatedData?.userUsername;
    if (username) {
      return {
        to: "/profile/$username" as const,
        params: { username },
      };
    }
    return null;
  };

  const navigationProps = getNavigationProps();

  useEffect(() => {
    if (inView && isUnopened) {
      markNotificationAsOpened(notification.id);
    }
  }, [inView, isUnopened, notification.id, markNotificationAsOpened]);

  return (
    <div
      ref={ref}
      key={notification.id}
      className="relative shadow-sm bg-opacity-50 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between transition-shadow duration-200 mb-4 bg-card border border-border"
    >
      {isUnopened && (
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-blue-500" />
      )}
      <div className="flex flex-row flex-nowrap w-full justify-start items-center gap-3 ">
        {/* Always show coach avatar for COACH notifications */}
        {notification.type === "COACH" && (
          <Avatar>
            <AvatarImage
              src="/images/jarvis_logo_transparent.png"
              alt="Coach"
            />
            <AvatarFallback>C</AvatarFallback>
          </Avatar>
        )}
        {/* Show user avatars for other notification types */}
        {[
          "FRIEND_REQUEST",
          "PLAN_INVITATION",
          "INFO",
        ].includes(notification.type) &&
          hasPictureData(notification) && navigationProps && (
            <Link {...navigationProps} onClick={onClose}>
              <Avatar>
                <AvatarImage
                  src={relatedData.picture || (relatedData as any).commenterPicture || (relatedData as any).reactorPicture || (relatedData as any).userPicture}
                  alt={relatedData.name || (relatedData as any).commenterName || (relatedData as any).reactorName || (relatedData as any).userName || ""}
                />
                <AvatarFallback>
                  {(relatedData.name || (relatedData as any).commenterName || (relatedData as any).reactorName || (relatedData as any).userName || "U")[0]}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
        {navigationProps ? (
          <Link {...navigationProps} onClick={onClose}>
            <div className="markdown text-sm text-foreground">
              <Remark>{notification.message}</Remark>
              <div className="text-xs text-muted-foreground mt-1">
                {formatTimeAgo(notification.createdAt)}
              </div>
            </div>
          </Link>
        ) : (
          <div className="markdown text-sm text-foreground">
            <Remark>{notification.message}</Remark>
            <div className="text-xs text-muted-foreground mt-1">
              {formatTimeAgo(notification.createdAt)}
            </div>
          </div>
        )}
      </div>
      <div className="flex ml-4">
        {renderActionButtons(notification)}
      </div>
    </div>
  );
};

interface NotificationsProps {
  onClose?: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ onClose }) => {
  const {
    concludeNotification,
    clearAllNotifications,
    notifications,
    isLoadingNotifications,
    markNotificationAsOpened,
  } = useDataNotifications();
  const navigate = useNavigate()
  const themeColors = useThemeColors();
  const { logError } = useLogError();
  const variants = getThemeVariants(themeColors.raw);
  const { isPushGranted, requestPermission } = useNotifications();
  const {
    currentUser,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useCurrentUser();

  // Debounced batching for marking notifications as opened
  const notificationQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<number | null>(null);

  const flushNotificationQueue = useCallback(() => {
    if (notificationQueueRef.current.size > 0) {
      const idsToMark = Array.from(notificationQueueRef.current);
      markNotificationAsOpened(idsToMark);
      notificationQueueRef.current.clear();
    }
  }, [markNotificationAsOpened]);

  const debouncedMarkAsOpened = useCallback((notificationId: string) => {
    // Add to queue
    notificationQueueRef.current.add(notificationId);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for 3 seconds
    debounceTimerRef.current = setTimeout(() => {
      flushNotificationQueue();
    }, 3000);
  }, [flushNotificationQueue]);

  // Cleanup on unmount - flush any pending notifications
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      flushNotificationQueue();
    };
  }, [flushNotificationQueue]);

  const handleNotificationAction = async (
    notification: Notification,
    action: string
  ) => {
    const actionPromise = async () => {
      if (notification.type === "INFO") {
        await concludeNotification({ notificationId: notification.id });
      } else if (notification.type === "ENGAGEMENT") {
        if (action === "dismiss") {
          await concludeNotification({ notificationId: notification.id });
        } else if (action === "respond") {
          // posthog.capture("engagement-notification-interacted", {
          //   notification_id: notification.id,
          // });
          // if (
          //   notification.relatedData &&
          //   (notification.relatedData as any).messageId &&
          //   (notification.relatedData as any).messageText
          // ) {
          //   router.push(
          //     `/ai?assistantType=activity-extraction&messageId=${
          //       (notification.relatedData as any).messageId
          //     }&messageText=${(notification.relatedData as any).messageText}`
          //   );
          // } else {
          //   toast.error(
          //     "Something went wrong. Please be so kind and open a bug report."
          //   );
          // }
          console.warn("Repsond to ai not implemented")
          logError(new Error("Respond to ai not implemented"))
        }
        await concludeNotification({ notificationId: notification.id });
      } else if (notification.type === "PLAN_INVITATION") {
        navigate({ to: `/join-plan/${notification.relatedId}` });
      } else if (notification.type === "FRIEND_REQUEST") {
        const relatedData = notification.relatedData as {
          id: string;
          username: string;
        } | null;
        if (!relatedData?.id || !relatedData?.username) {
          logError(
            new Error(
              `No related data found when ${
                currentUser?.username ?? "'unknown user'"
              } was about about to ${action} a friend request ${
                notification.id
              }`
            )
          );
          return;
        }
        if (action === "accept") {
          await acceptFriendRequest({
            id: relatedData.id,
            username: relatedData.username,
          });
        } else if (action === "reject") {
          await rejectFriendRequest({
            id: relatedData.id,
            username: relatedData.username,
          });
        }
        await concludeNotification({ notificationId: notification.id, mute: true });
      }
    };

    actionPromise();
  };

  const renderActionButtons = (notification: Notification) => {
    const buttonClasses =
      "p-2 rounded-full transition-colors duration-200 flex items-center justify-center";
    const iconSize = 20;

    switch (notification.type) {
      case "FRIEND_REQUEST":
        return (
          <>
            <button
              onClick={() => handleNotificationAction(notification, "accept")}
              className={`${buttonClasses} bg-green-100 text-green-600 hover:bg-green-200`}
              aria-label="Accept"
            >
              <Check size={iconSize} />
            </button>
            <button
              onClick={() => handleNotificationAction(notification, "reject")}
              className={`${buttonClasses} bg-red-100 text-red-600 hover:bg-red-200 ml-2`}
              aria-label="Reject"
            >
              <X size={iconSize} />
            </button>
          </>
        );
      case "PLAN_INVITATION":
        return (
          <button
            onClick={() => handleNotificationAction(notification, "view")}
            className={`${buttonClasses} ${variants.fadedBg} ${variants.text} hover:bg-blue-200`}
            aria-label="View"
          >
            <Eye size={iconSize} />
          </button>
        );
      default:
        return (
          <>
            <button
              onClick={() => handleNotificationAction(notification, "dismiss")}
              className={`${buttonClasses} bg-muted text-muted-foreground hover:bg-muted/80 ml-2`}
              aria-label="Dismiss"
            >
              <X size={iconSize} />
            </button>
          </>
        );
    }
  };

  const hasPictureData = (notification: Notification) => {
    if (!notification.relatedData) return false;
    const data = notification.relatedData as any;
    return !!(
      data.picture ||
      data.commenterPicture ||
      data.reactorPicture ||
      data.userPicture
    );
  };
  const hasUsernameData = (notification: Notification) => {
    return (
      notification.relatedData && (notification.relatedData as any).username
    );
  };

  // Get the latest engagement notification
  // const latestEngagementNotification =
  //   notificationsData?.data?.notifications?.find(
  //     (n) => n.type === "ENGAGEMENT"
  //   );

  // Filter out engagement notifications from the regular notifications
  const regularNotifications = notifications?.filter(
    (n) => n.type !== "ENGAGEMENT"
  );

  // Define priority for notification types (lower number = higher priority)
  const getNotificationPriority = (notification: Notification): number => {
    switch (notification.type) {
      case "FRIEND_REQUEST":
        return 1;
      case "PLAN_INVITATION":
        return 2;
      case "COACH":
        return 3;
      case "INFO":
        return 4;
      default:
        return 5;
    }
  };

  // Show all non-concluded notifications, sorted by priority then by date
  const displayedNotifications =
    regularNotifications
      ?.filter((n) => n.status !== "CONCLUDED")
      .sort((a, b) => {
        const priorityDiff = getNotificationPriority(a) - getNotificationPriority(b);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        // If same priority, sort by creation date (most recent first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }) || [];

  if (isLoadingNotifications) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="p-4 rounded-2xl border border-border bg-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-row items-center gap-3 flex-1">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex ml-4 gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (displayedNotifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="bg-muted p-4 rounded-full mb-4">
          <Check size={48} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">All up to date!</h2>
        {!isPushGranted && (
          <p className="text-muted-foreground text-sm">
            <button className="underline" onClick={requestPermission}>
              Click here
            </button>{" "}
            to be notified of new notifications.
          </p>
        )}
        {isPushGranted && (
          <p className="text-muted-foreground text-sm">
            Come back later to see new notifications.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* {latestEngagementNotification && (
        <AINotification
          message={latestEngagementNotification.message}
          createdAt={latestEngagementNotification.createdAt}
          onDismiss={(e) => {
            e.stopPropagation();
            handleNotificationAction(latestEngagementNotification, "dismiss");
          }}
          onClick={() =>
            handleNotificationAction(latestEngagementNotification, "respond")
          }
        />
      )} */}

      {regularNotifications && regularNotifications.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <button
              onClick={clearAllNotifications}
              className="text-sm px-3 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors duration-200"
            >
              Clear All
            </button>
          </div>

          {displayedNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              markNotificationAsOpened={debouncedMarkAsOpened}
              handleNotificationAction={handleNotificationAction}
              renderActionButtons={renderActionButtons}
              hasPictureData={hasPictureData}
              hasUsernameData={hasUsernameData}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Notifications;

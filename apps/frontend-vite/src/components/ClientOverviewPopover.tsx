import AppleLikePopover from "@/components/AppleLikePopover";
import { useApiWithAuth } from "@/api";
import { type CompletePlan } from "@/contexts/plans";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import { useQuery } from "@tanstack/react-query";
import { isSameDay, subWeeks } from "date-fns";
import { Loader2, MessageCircle } from "lucide-react";
import React, { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { CalendarGrid, type CalendarSession } from "./CalendarGrid";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import { useNavigate } from "@tanstack/react-router";

interface ClientOverviewPopoverProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  clientInfo: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
  planGoal: string;
  planEmoji: string | null;
}

interface ClientPlanResponse extends CompletePlan {
  user: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
  activityEntries: ActivityEntry[];
}

const ClientOverviewPopover: React.FC<ClientOverviewPopoverProps> = ({
  open,
  onClose,
  planId,
  clientInfo,
  planGoal,
  planEmoji,
}) => {
  const api = useApiWithAuth();
  const navigate = useNavigate();

  const { data: clientPlan, isLoading } = useQuery({
    queryKey: ["coach-client-plan", planId],
    queryFn: async () => {
      const response = await api.get<ClientPlanResponse>(
        `/coaches/clients/${planId}`
      );
      return response.data;
    },
    enabled: open && !!planId,
  });

  const handleMessageClient = () => {
    onClose();
    navigate({ to: `/messages/${clientInfo.username}` });
  };

  // Convert plan sessions to CalendarSession format
  const calendarSessions: CalendarSession[] = useMemo(() => {
    if (!clientPlan?.sessions) return [];
    return clientPlan.sessions.map((session) => ({
      date: new Date(session.date),
      activityId: session.activityId,
      quantity: session.quantity,
      descriptiveGuide: session.descriptiveGuide,
      imageUrls: session.imageUrls,
    }));
  }, [clientPlan?.sessions]);

  // Convert plan activities to CalendarActivity format
  const calendarActivities = useMemo(() => {
    if (!clientPlan?.activities) return [];
    return clientPlan.activities.map((a) => ({
      id: a.id,
      title: a.title,
      emoji: a.emoji || undefined,
      measure: a.measure,
    }));
  }, [clientPlan?.activities]);

  // Check if an activity was completed on a specific day
  const isCompletedOnDay = useMemo(() => {
    if (!clientPlan?.activityEntries) return () => false;
    return (activityId: string, day: Date) => {
      return clientPlan.activityEntries.some(
        (entry) =>
          entry.activityId === activityId &&
          isSameDay(new Date(entry.datetime), day)
      );
    };
  }, [clientPlan?.activityEntries]);

  return (
    <AppleLikePopover
      open={open}
      onClose={onClose}
      title="Client Overview"
    >
      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Client Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={clientInfo.picture || undefined} />
              <AvatarFallback>
                {(clientInfo.name || clientInfo.username)[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground">
                {clientInfo.name || clientInfo.username}
              </h3>
              <p className="text-sm text-muted-foreground">
                {planEmoji || "📋"} {planGoal}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMessageClient}
            className="gap-2"
          >
            <MessageCircle size={16} />
            Message
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : clientPlan ? (
          <>
            {/* Two Week Calendar View */}
            <div className="space-y-2">
              <h4 className="text-md font-semibold text-foreground">
                Upcoming Schedule
              </h4>
              <CalendarGrid
                sessions={calendarSessions}
                activities={calendarActivities}
                isCompletedOnDay={isCompletedOnDay}
                showLegend={true}
              />
            </div>

            {/* Past Loggings - Limited to last 4 weeks for compact view */}
            <div className="space-y-2">
              <h4 className="text-md font-semibold text-foreground">
                Activity History
              </h4>
              <PlanActivityEntriesRenderer
                plan={clientPlan}
                activities={clientPlan.activities as Activity[]}
                activityEntries={clientPlan.activityEntries}
                startDate={subWeeks(new Date(), 4)}
                endDate={new Date()}
              />
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Unable to load client data
          </div>
        )}
      </div>
    </AppleLikePopover>
  );
};

export default ClientOverviewPopover;

import AppleLikePopover from "@/components/AppleLikePopover";
import { useApiWithAuth } from "@/api";
import { type CompletePlan } from "@/contexts/plans";
import { type Activity, type ActivityEntry } from "@tsw/prisma";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isSameDay, subWeeks } from "date-fns";
import { Loader2, MessageCircle } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { CalendarGrid, type CalendarSession, type CalendarActivity } from "./CalendarGrid";
import PlanActivityEntriesRenderer from "./PlanActivityEntriesRenderer";
import { useNavigate } from "@tanstack/react-router";
import SessionEditor, { type SessionUpdateData } from "./SessionEditor";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

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

  const updateSessionMutation = useMutation({
    mutationFn: async (data: { sessionId: string; updates: SessionUpdateData }) => {
      const response = await api.patch(`/coaches/sessions/${data.sessionId}`, data.updates);
      return { sessionId: data.sessionId, updates: data.updates, response: response.data };
    },
    onSuccess: ({ sessionId, updates }) => {
      // Update query data directly
      queryClient.setQueryData<ClientPlanResponse>(
        ["coach-client-plan", planId],
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            sessions: oldData.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    ...(updates.activityId && { activityId: updates.activityId }),
                    ...(updates.date && { date: updates.date }),
                    ...(updates.quantity !== undefined && { quantity: updates.quantity }),
                    ...(updates.descriptiveGuide !== undefined && { descriptiveGuide: updates.descriptiveGuide }),
                  }
                : s
            ),
          };
        }
      );
      toast.success("Session updated successfully");
      setEditingSessionId(null);
    },
    onError: (error) => {
      toast.error("Failed to update session");
      console.error("Session update error:", error);
    },
  });

  const handleUploadImages = async (sessionId: string, files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    const response = await api.post<{ imageUrls: string[]; newUrls: string[] }>(
      `/coaches/sessions/${sessionId}/upload-images`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    // Update query data directly instead of invalidating
    queryClient.setQueryData<ClientPlanResponse>(
      ["coach-client-plan", planId],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          sessions: oldData.sessions.map((s) =>
            s.id === sessionId ? { ...s, imageUrls: response.data.imageUrls } : s
          ),
        };
      }
    );

    toast.success("Images uploaded successfully");
    return response.data.imageUrls;
  };

  const handleDeleteImage = async (sessionId: string, imageUrl: string) => {
    await api.delete(`/coaches/sessions/${sessionId}/images`, {
      data: { imageUrl },
    });

    // Update query data directly instead of invalidating
    queryClient.setQueryData<ClientPlanResponse>(
      ["coach-client-plan", planId],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          sessions: oldData.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, imageUrls: (s.imageUrls || []).filter((url) => url !== imageUrl) }
              : s
          ),
        };
      }
    );
  };

  const handleMessageClient = () => {
    onClose();
    navigate({ to: `/messages/${clientInfo.username}` });
  };

  const handleSessionEdit = (session: CalendarSession) => {
    if (session.id) {
      setEditingSessionId(session.id);
    }
  };

  const handleSessionSave = (sessionId: string, updates: SessionUpdateData) => {
    updateSessionMutation.mutate({ sessionId, updates });
  };

  // Convert plan sessions to CalendarSession format
  const calendarSessions: CalendarSession[] = useMemo(() => {
    if (!clientPlan?.sessions) return [];
    return clientPlan.sessions.map((session) => ({
      id: session.id,
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

  // Get the editing session from fresh query data (must be after calendarSessions/calendarActivities)
  const editingSession = useMemo(() => {
    if (!editingSessionId) return null;
    const session = calendarSessions.find((s) => s.id === editingSessionId);
    if (!session) return null;
    const activity = calendarActivities.find((a) => a.id === session.activityId);
    if (!activity) return null;
    return { session, activity };
  }, [editingSessionId, calendarSessions, calendarActivities]);

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
                onSessionEdit={handleSessionEdit}
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

      {/* Session Editor */}
      {editingSession && (
        <SessionEditor
          key={JSON.stringify(editingSession.session)}
          open={!!editingSession}
          onClose={() => setEditingSessionId(null)}
          session={editingSession.session}
          activities={calendarActivities}
          onSave={handleSessionSave}
          onUploadImages={handleUploadImages}
          onDeleteImage={handleDeleteImage}
          isSaving={updateSessionMutation.isPending}
        />
      )}
    </AppleLikePopover>
  );
};

export default ClientOverviewPopover;

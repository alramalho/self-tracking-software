import { useApiWithAuth } from "@/api";
import { normalizeApiResponse } from "@/utils/dateUtils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CircleBoard,
  CircleChat,
  CircleCard,
  CircleFeed,
  CircleFeedEntry,
  CircleMemberInput,
  InvitableFriend,
  InviteFriendInput,
  JoinByInviteInput,
  JoinCircleInput,
  JoinedCircle,
  MatchPreferences,
  MatchResult,
  MuteCircleInput,
  MyCircle,
  PendingMatch,
  PlanSuggestions,
  StartCircleInput,
  UpdateCircleInput,
} from "./types";

export const defaultPreferences: MatchPreferences = {
  wantsPace: true,
  wantsNearby: false,
  wantsAge: false,
};

// Links people open in the browser or the app. Both route /circle-invite/:code.
export const inviteLink = (code: string) =>
  `https://app.tracking.so/circle-invite/${code}`;

export const circleQueryKeys = {
  all: ["circles"] as const,
  mine: ["circles", "mine"] as const,
  suggestions: ["circles", "suggestions"] as const,
  search: (query: string) => ["circles", "search", query] as const,
  board: (id: string) => ["circle", id] as const,
  feed: (id: string) => ["circle", id, "feed"] as const,
  invitable: (id: string) => ["circle", id, "invitable"] as const,
  invite: (code: string) => ["circle-invite", code] as const,
  match: (planId: string) => ["circle-match", planId] as const,
};

// Only the three levers, even when handed a whole pending match.
const preferenceFields = ({ wantsPace, wantsNearby, wantsAge }: MatchPreferences) => ({
  wantsPace,
  wantsNearby,
  wantsAge,
});

const normalizeFeedEntry = (entry: CircleFeedEntry) =>
  normalizeApiResponse<CircleFeedEntry>(entry, [
    "datetime",
    "createdAt",
    "comments.createdAt",
  ]);

export const useMyCircles = (enabled = true) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled,
    queryKey: circleQueryKeys.mine,
    queryFn: async () => (await api.get<MyCircle[]>("/circles/mine")).data,
    staleTime: 1000 * 60,
  });
};

export const useCircle = (id?: string) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled: !!id,
    queryKey: circleQueryKeys.board(id ?? ""),
    queryFn: async () => (await api.get<CircleBoard>(`/circles/${id}`)).data,
    staleTime: 1000 * 30,
  });
};

export const useCircleFeed = (id?: string) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled: !!id,
    queryKey: circleQueryKeys.feed(id ?? ""),
    queryFn: async () => {
      const feed = (await api.get<CircleFeed>(`/circles/${id}/feed`)).data;
      return { ...feed, entries: feed.entries.map(normalizeFeedEntry) };
    },
    staleTime: 1000 * 30,
  });
};

// The viewer's friends, with who's already in this circle or already invited.
export const useInvitableFriends = (id: string, enabled: boolean) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled,
    queryKey: circleQueryKeys.invitable(id),
    queryFn: async () =>
      (await api.get<InvitableFriend[]>(`/circles/${id}/invitable`)).data,
  });
};

export const useCircleSuggestions = (enabled = true) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled,
    queryKey: circleQueryKeys.suggestions,
    queryFn: async () =>
      (await api.get<PlanSuggestions[]>("/circles/suggestions")).data,
    staleTime: 1000 * 60,
  });
};

export const useCircleSearch = (query: string) => {
  const api = useApiWithAuth();
  const trimmed = query.trim();
  return useQuery({
    enabled: trimmed.length > 0,
    queryKey: circleQueryKeys.search(trimmed),
    queryFn: async () =>
      (await api.get<CircleCard[]>("/circles/search", { params: { q: trimmed } }))
        .data,
  });
};

export const useCircleInvite = (code?: string) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled: !!code,
    queryKey: circleQueryKeys.invite(code ?? ""),
    queryFn: async () =>
      (await api.get<CircleCard>(`/circles/invites/${code}`)).data,
  });
};

// Finds the best circle for a plan. Nothing is joined until the person taps Join.
export const useCircleMatch = (pending: PendingMatch) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled: !!pending.planId && pending.mode === "find",
    queryKey: circleQueryKeys.match(pending.planId),
    staleTime: Infinity,
    gcTime: 0,
    retry: 1,
    queryFn: async () => {
      const body = { planId: pending.planId, ...preferenceFields(pending), location: pending.location };
      return (await api.post<MatchResult>("/circles/match", body)).data;
    },
  });
};

// Everything that changes membership: joining, starting, leaving and the owner's controls.
export const useCircleActions = () => {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const refreshCircles = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: circleQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["circle"] }),
      queryClient.invalidateQueries({ queryKey: ["timeline"] }),
    ]);

  const startCircle = useMutation({
    mutationFn: async (input: StartCircleInput) =>
      (
        await api.post<JoinedCircle>("/circles", {
          planId: input.planId,
          ...preferenceFields(input.preferences),
        })
      ).data,
    onSuccess: refreshCircles,
  });

  const joinCircle = useMutation({
    mutationFn: async (input: JoinCircleInput) =>
      (
        await api.post<JoinedCircle>(`/circles/${input.circleId}/join`, {
          planId: input.planId,
          ...preferenceFields(input.preferences),
        })
      ).data,
    onSuccess: refreshCircles,
  });

  const joinByInvite = useMutation({
    mutationFn: async (input: JoinByInviteInput) =>
      (
        await api.post<JoinedCircle>(`/circles/invites/${input.code}`, {
          planId: input.planId,
          ...preferenceFields(input.preferences),
        })
      ).data,
    onSuccess: refreshCircles,
  });

  const updateCircle = useMutation({
    mutationFn: async (input: UpdateCircleInput) =>
      api.patch(`/circles/${input.circleId}`, input.changes),
    onSuccess: refreshCircles,
  });

  // Your own switch for this circle's pushes (chat messages and Helly's posts).
  const muteCircle = useMutation({
    mutationFn: async (input: MuteCircleInput) =>
      api.patch(`/circles/${input.circleId}/membership`, { muted: input.muted }),
    onSuccess: refreshCircles,
  });

  const leaveCircle = useMutation({
    mutationFn: async (circleId: string) =>
      api.delete(`/circles/${circleId}/membership`),
    onSuccess: refreshCircles,
  });

  const removeMember = useMutation({
    mutationFn: async (input: CircleMemberInput) =>
      api.delete(`/circles/${input.circleId}/members/${input.userId}`),
    onSuccess: refreshCircles,
  });

  // One notification that opens the circle's join screen.
  const inviteFriend = useMutation({
    mutationFn: async (input: InviteFriendInput) =>
      api.post(`/circles/${input.circleId}/invites`, { userId: input.userId }),
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({ queryKey: circleQueryKeys.invitable(input.circleId) }),
  });

  // "Later" on the first-photo prompt: recorded so the coach can remind them tomorrow.
  const skipProof = useMutation({
    mutationFn: async (circleId: string) => api.post(`/circles/${circleId}/proof-skipped`),
  });

  // The circle's group chat, created on first open. Only proven (non-pending) members get in.
  const openChat = useMutation({
    mutationFn: async (circleId: string) =>
      (await api.post<CircleChat>(`/circles/${circleId}/chat`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });

  return {
    startCircle,
    joinCircle,
    joinByInvite,
    updateCircle,
    muteCircle,
    leaveCircle,
    removeMember,
    inviteFriend,
    skipProof,
    openChat,
  };
};

// Opening the composer is local. Only an explicit Send creates a chat/message.
export function useEncouragementActions() {
  const api = useApiWithAuth();
  return {
    openEncouragementChat: async (circleId: string, userId: string): Promise<string> =>
      (await api.post<{ chat: { id: string } }>("/chats/direct", { userId, circleId })).data.chat.id,
    sendEncouragement: async (chatId: string, message: string): Promise<void> => {
      await api.post(`/chats/${encodeURIComponent(chatId)}/messages`, { message: message.trim() });
    },
  };
}

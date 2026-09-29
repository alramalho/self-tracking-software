import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import type {
  CircleBoard,
  CircleCard,
  CircleFeed,
  MatchPreferences,
  MatchResult,
  MyCircle,
  PendingMatch,
  PlanSuggestions,
} from "./types";

export const useMyCircles = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["circles", "mine"],
    queryFn: async () => (await api.get<MyCircle[]>("/circles/mine")).data,
  });

export const useCircle = (id?: string) =>
  useQuery({
    enabled: !!id,
    queryKey: ["circle", id],
    queryFn: async () => (await api.get<CircleBoard>(`/circles/${id}`)).data,
  });

export const useCircleFeed = (id?: string) =>
  useQuery({
    enabled: !!id,
    queryKey: ["circle", id, "feed"],
    queryFn: async () => (await api.get<CircleFeed>(`/circles/${id}/feed`)).data,
  });

export const useCircleSuggestions = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["circles", "suggestions"],
    queryFn: async () => (await api.get<PlanSuggestions[]>("/circles/suggestions")).data,
  });

export const useCircleSearch = (query: string) =>
  useQuery({
    enabled: query.trim().length > 0,
    queryKey: ["circles", "search", query.trim()],
    queryFn: async () =>
      (await api.get<CircleCard[]>("/circles/search", { params: { q: query.trim() } })).data,
  });

export const useInvite = (code?: string) =>
  useQuery({
    enabled: !!code,
    queryKey: ["circle-invite", code],
    queryFn: async () => (await api.get<CircleCard>(`/circles/invites/${code}`)).data,
  });

export async function matchCircle(pending: PendingMatch) {
  return (await api.post<MatchResult>("/circles/match", pending)).data;
}

export async function startCircle(planId: string, preferences: MatchPreferences) {
  return (await api.post<{ id: string }>("/circles", { planId, ...preferences })).data;
}

export async function joinCircle(circleId: string, planId: string, preferences: MatchPreferences) {
  return (await api.post<{ id: string; pending: boolean }>(`/circles/${circleId}/join`, { planId, ...preferences })).data;
}

export async function joinByInvite(code: string, planId: string, preferences: MatchPreferences) {
  return (await api.post<{ id: string; pending: boolean }>(`/circles/invites/${code}`, { planId, ...preferences })).data;
}

// The circle's group chat; only proven members can open it.
export async function openCircleChat(circleId: string) {
  return (await api.post<{ chatId: string }>(`/circles/${circleId}/chat`)).data;
}

// "Later" on the first-photo prompt: recorded so the coach can remind them.
export async function skipProof(circleId: string) {
  await api.post(`/circles/${circleId}/proof-skipped`);
}

export const defaultPreferences: MatchPreferences = {
  wantsPace: true,
  wantsNearby: false,
  wantsAge: false,
};

// Links people open in Safari or the app. The web app routes /circle-invite/:code too.
export const inviteLink = (code: string) => `https://app.tracking.so/circle-invite/${code}`;

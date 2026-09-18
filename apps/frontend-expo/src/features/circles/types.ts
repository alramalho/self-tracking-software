import type { Person } from "@/core/types";
export interface CircleSummary { id: string; name: string; topic: string; discoverable: boolean; _count: { members: number }; }
export interface CircleList { mine: CircleSummary[]; discover: CircleSummary[]; }
export interface CircleDetail extends CircleSummary { inviteCode: string; members: { user: Person; owner: boolean; plan: { id: string; goal: string; emoji: string } }[]; posts: { id: string; user: Person; createdAt: string; entry: { id: string; datetime: string; quantity: number; activity: { title: string; emoji: string; measure: string } | null } }[]; }

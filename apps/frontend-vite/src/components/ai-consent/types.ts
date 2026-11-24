export interface AiConsentFields {
  aiConsentGrantedAt?: string | Date | null;
  aiConsentDeclinedAt?: string | Date | null;
}

/** This month's AI uses against the fair-use allowance; resets on the 1st (UTC). */
export interface AiUsage {
  used: number;
  limit: number;
  resetsAt: string;
}

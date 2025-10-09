import * as $runtime from "../runtime/library"

/**
 * @param planId - The plan ID to exclude from results
 * @param embedding - The embedding vector as a JSON string
 * @param userIds - Array of user IDs to filter by (pass as text[] in Postgres)
 * @param limit - Maximum number of results to return
 */
export const semanticSearchWithUsers: (planId: string, embedding: string, userIds: $runtime.InputJsonObject, limit: number) => $runtime.TypedSql<semanticSearchWithUsers.Parameters, semanticSearchWithUsers.Result>

export namespace semanticSearchWithUsers {
  export type Parameters = [planId: string, embedding: string, userIds: $runtime.InputJsonObject, limit: number]
  export type Result = {
    planId: string
    goal: string
    userId: string
    emoji: string | null
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    finishingDate: Date | null
    similarity: number | null
  }
}

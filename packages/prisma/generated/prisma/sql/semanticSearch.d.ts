import * as $runtime from "../runtime/library"

/**
 * @param planId - The plan ID to exclude from results
 * @param embedding - The embedding vector as a JSON string
 * @param limit - Maximum number of results to return
 */
export const semanticSearch: (planId: string, embedding: string, limit: number) => $runtime.TypedSql<semanticSearch.Parameters, semanticSearch.Result>

export namespace semanticSearch {
  export type Parameters = [planId: string, embedding: string, limit: number]
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

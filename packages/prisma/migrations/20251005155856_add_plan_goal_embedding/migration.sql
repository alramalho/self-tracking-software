-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add goalEmbedding column to plans table
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create index for faster similarity searches (using cosine distance)
CREATE INDEX IF NOT EXISTS "plans_embedding_idx" ON "plans" USING ivfflat ("embedding" vector_cosine_ops);

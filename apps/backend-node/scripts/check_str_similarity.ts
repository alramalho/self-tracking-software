import { embeddingService } from "../src/services/embeddingService";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

async function checkStringSimilarity(str1: string, str2: string) {
  console.log("String 1:", str1);
  console.log("String 2:", str2);
  const model = "text-embedding-3-large";
  console.log(`\nGenerating embeddings for model: ${model}`);

  const [embedding1, embedding2] = await embeddingService.generateEmbeddings([
    str1,
    str2,
    model,
  ]);

  const similarity = cosineSimilarity(embedding1, embedding2);

  console.log("\nSimilarity Score:", similarity.toFixed(4));
  console.log("Percentage:", (similarity * 100).toFixed(2) + "%");
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    "Usage: pnpm tsx scripts/check_str_similarity.ts <string1> <string2>"
  );
  process.exit(1);
}

const [str1, str2] = args;

checkStringSimilarity(str1, str2)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

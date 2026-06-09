import {
  createOpenRouter,
} from "@openrouter/ai-sdk-provider";
import { writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod/v4";
import dedent from "dedent";

dotenv.config({ path: resolve(__dirname, "../../apps/backend-node/.env") });

let createGateway: any;
let generateText: any;
let generateObject: any;
let generateImage: any;
let gateway: any;

async function loadAISDK(): Promise<void> {
  const aiSdk = await import("../../apps/backend-node/src/utils/aiSdk");
  createGateway = aiSdk.createGateway;
  generateText = aiSdk.generateText;
  generateObject = aiSdk.generateObject;
  generateImage = aiSdk.generateImage;
  gateway = createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// --- Config ---

const CONCURRENCY = 5;

// Image models to compare
const IMAGE_MODELS = [
  { id: "google/gemini-2.5-flash-image", label: "gemini-2.5-flash-image", type: "generateText" as const },
  { id: "google/gemini-3-pro-image", label: "gemini-3-pro-image", type: "generateText" as const },
  { id: "google/gemini-3.1-flash-image-preview", label: "gemini-3.1-flash-image-preview", type: "generateText" as const },
  { id: "openai/gpt-image-2", label: "gpt-image-2-low", type: "generateImage" as const, quality: "low" as const },
  { id: "openai/gpt-image-2", label: "gpt-image-2-medium", type: "generateImage" as const, quality: "medium" as const },
];

// Coach model — same as pipeline uses
const COACH_MODEL = "openai/gpt-5.2-chat";

interface TestSession {
  plan: string;
  activity: string;
  measure: string;
  descriptiveGuide: string;
}

const TEST_SESSIONS: TestSession[] = [
  {
    plan: "Run a 10k race",
    activity: "Easy run",
    measure: "minutes",
    descriptiveGuide:
      "Focus on maintaining a conversational pace throughout this 25-minute easy run. Keep your breathing relaxed and your stride short — if you can't hold a conversation, slow down. This builds your aerobic base without stressing your joints.",
  },
  {
    plan: "Run a 10k race",
    activity: "Interval Training",
    measure: "minutes",
    descriptiveGuide:
      "This 20-minute interval session alternates between 1-minute faster efforts and 2-minute easy recovery jogs. Push during the fast intervals but not to a sprint — aim for a pace where you're breathing hard but in control. Walk if you need to recover.",
  },
  {
    plan: "Build a meditation habit",
    activity: "Guided meditation",
    measure: "minutes",
    descriptiveGuide:
      "This 10-minute guided session focuses on body scan awareness. Sit comfortably with your back straight, close your eyes, and slowly move your attention from your toes to the top of your head. Notice sensations without judgment.",
  },
  {
    plan: "Get stronger at the gym",
    activity: "Strength training",
    measure: "minutes",
    descriptiveGuide:
      "This 35-minute full-body session covers compound movements: 3 sets of squats, bench press, and bent-over rows. Start with a weight you can lift for 8-10 reps with good form. Rest 90 seconds between sets and focus on controlled movement.",
  },
  {
    plan: "Get stronger at the gym",
    activity: "Core exercises",
    measure: "minutes",
    descriptiveGuide:
      "A 15-minute core circuit: 30-second plank, 15 dead bugs per side, and 15 bird-dogs per side. Repeat 3 rounds with 30 seconds rest between exercises. Keep your lower back pressed into the floor during dead bugs.",
  },
];

// --- Step 1: Have the coach LLM generate imagePrompts (same schema as pipeline) ---

async function generateCoachImagePrompts(
  sessions: TestSession[]
): Promise<string[][]> {
  console.log(`Generating imagePrompts via coach (${COACH_MODEL})...`);
  const t0 = Date.now();

  const schema = z.object({
    sessions: z.array(
      z.object({
        imagePrompts: z
          .array(z.string())
          .describe(
            "0-2 prompts for generating accompanying visual aids for this session. Each prompt should describe a specific illustration that adds visual information the text cannot — e.g. body posture/form, movement phases, breathing patterns, progression visualization. Leave empty if the session doesn't benefit from visuals (e.g. reading, journaling). Do NOT repeat the session description as text in the image — the image should show what words can't."
          ),
      })
    ),
  });

  const result = await generateObject({
    model: openrouter.chat(COACH_MODEL),
    schema,
    system: dedent`
      You are a personal coach. For each session below, decide whether accompanying
      illustrations would help the user and, if so, write image generation prompts.

      IMAGE PROMPTS (optional visual aids):
      - For each session, decide if 0-2 accompanying illustrations would help the user
      - Good image prompts describe visuals that ADD information beyond the text: proper form/posture diagrams, movement phase illustrations, breathing pattern visuals, technique breakdowns
      - Skip images for sessions where visuals don't help (reading, journaling, rest)
      - Each prompt should be a self-contained image generation instruction
      - Style: clean instructional illustration, minimal background, annotated form cues with arrows. No text banners or motivational slogans in the image
    `,
    prompt: sessions
      .map(
        (s, i) =>
          `Session ${i}: ${s.activity} (${s.measure}) — ${s.descriptiveGuide}`
      )
      .join("\n\n"),
    temperature: 0.3,
  });

  const prompts = result.object.sessions.map((s) => s.imagePrompts);
  console.log(
    `  Coach generated prompts in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${prompts.map((p) => p.length).join(", ")} per session\n`
  );
  return prompts;
}

// --- Step 2: Generate images ---

async function generateWithText(
  modelId: string,
  prompt: string
): Promise<Buffer> {
  const result = await generateText({
    model: gateway(modelId),
    prompt,
  });
  const file = result.files?.[0];
  if (!file) throw new Error(`No image returned from ${modelId}`);
  return Buffer.from(file.uint8Array);
}

async function generateWithImage(
  modelId: string,
  prompt: string,
  quality?: string
): Promise<Buffer> {
  const result = await generateImage({
    model: gateway.imageModel(modelId),
    prompt,
    size: "1024x1024",
    providerOptions: quality ? { openai: { quality } } : undefined,
  });
  const img = result.images[0];
  if (!img) throw new Error(`No image returned from ${modelId}`);
  if (img.uint8Array) return Buffer.from(img.uint8Array);
  if (img.base64) return Buffer.from(img.base64, "base64");
  throw new Error(`No decodable image from ${modelId}`);
}

// Simple concurrency pool
async function pool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

// --- Main ---

async function main() {
  await loadAISDK();

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const expDir = join(__dirname, `exp_${ts}`);
  mkdirSync(expDir, { recursive: true });

  // Step 1: Coach generates imagePrompts
  const imagePrompts = await generateCoachImagePrompts(TEST_SESSIONS);

  // Save coach output
  writeFileSync(
    join(expDir, "coach-prompts.json"),
    JSON.stringify(
      TEST_SESSIONS.map((s, i) => ({
        ...s,
        imagePrompts: imagePrompts[i],
      })),
      null,
      2
    )
  );

  // Step 2: Build jobs — each imagePrompt × each model
  interface Job {
    testIndex: number;
    promptIndex: number;
    imagePrompt: string;
    model: (typeof IMAGE_MODELS)[number];
    session: TestSession;
  }

  const jobs: Job[] = [];
  for (let i = 0; i < TEST_SESSIONS.length; i++) {
    const prompts = imagePrompts[i];
    if (prompts.length === 0) {
      console.log(`[${i}] ${TEST_SESSIONS[i].activity}: no images (coach decided)`);
      continue;
    }
    for (let pi = 0; pi < prompts.length; pi++) {
      for (const model of IMAGE_MODELS) {
        jobs.push({
          testIndex: i,
          promptIndex: pi,
          imagePrompt: prompts[pi],
          model,
          session: TEST_SESSIONS[i],
        });
      }
    }
  }

  console.log(`${jobs.length} image jobs, concurrency ${CONCURRENCY}\n`);

  const tasks = jobs.map((job) => async () => {
    const genDir = join(
      expDir,
      `gen-${job.testIndex}-p${job.promptIndex}-${job.model.label}`
    );
    mkdirSync(genDir, { recursive: true });

    const t0 = Date.now();
    try {
      const buffer =
        job.model.type === "generateText"
          ? await generateWithText(job.model.id, job.imagePrompt)
          : await generateWithImage(job.model.id, job.imagePrompt, (job.model as any).quality);
      const durationMs = Date.now() - t0;

      writeFileSync(join(genDir, "image.png"), buffer);
      writeFileSync(
        join(genDir, "metadata.json"),
        JSON.stringify(
          {
            model: job.model.id,
            label: job.model.label,
            testIndex: job.testIndex,
            promptIndex: job.promptIndex,
            plan: job.session.plan,
            activity: job.session.activity,
            measure: job.session.measure,
            descriptiveGuide: job.session.descriptiveGuide,
            imagePrompt: job.imagePrompt,
            durationMs,
            imageFile: "image.png",
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );

      console.log(
        `  done ${job.model.label} [${job.testIndex}:p${job.promptIndex}] (${(durationMs / 1000).toFixed(1)}s)`
      );
    } catch (err: any) {
      const durationMs = Date.now() - t0;
      console.error(
        `  FAIL ${job.model.label} [${job.testIndex}:p${job.promptIndex}] (${(durationMs / 1000).toFixed(1)}s): ${err.message}`
      );
      writeFileSync(
        join(genDir, "metadata.json"),
        JSON.stringify(
          {
            model: job.model.id,
            label: job.model.label,
            testIndex: job.testIndex,
            promptIndex: job.promptIndex,
            plan: job.session.plan,
            activity: job.session.activity,
            imagePrompt: job.imagePrompt,
            error: err.message,
            durationMs,
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
  });

  const t0 = Date.now();
  await pool(tasks, CONCURRENCY);
  const totalMs = Date.now() - t0;

  console.log(
    `\nDone in ${(totalMs / 1000).toFixed(1)}s.\n  npx serve scripts/compare-image-gen\n  → report.html`
  );
}

main().catch(console.error);

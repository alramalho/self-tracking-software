import dotenv from "dotenv";

// Loads .env before anything reads process.env. AI tracing (Braintrust) was
// removed so prompts and replies are only sent to the AI providers listed in
// the app's AI consent sheet.
dotenv.config({ path: ".env" });

import dotenv from "dotenv";
import { initLogger } from "braintrust";

dotenv.config({ path: ".env" });

const braintrustApiKey = process.env.BRAINTRUST_API_KEY;
const braintrustProjectName =
  process.env.NODE_ENV === "production" ? "tracking so" : "tracking so dev";

if (braintrustApiKey) {
  try {
    initLogger({
      apiKey: braintrustApiKey,
      projectName: braintrustProjectName,
    });
  } catch (error) {
    console.warn("Braintrust initialization failed", error);
  }
}

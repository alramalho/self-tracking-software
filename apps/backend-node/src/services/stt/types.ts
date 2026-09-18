export interface STTConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  provider: "OpenAI" | "OpenRouter";
}

export interface TimestampedTranscript {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

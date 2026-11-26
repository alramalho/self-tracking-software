import OpenAI from "openai";
import { fileTypeFromBuffer } from "file-type";
import { assertAiConsent } from "../utils/aiConsent";
import { logger } from "../utils/logger";
import { resolveSTTConfig } from "./stt/config";
import {
  reportsLanguage,
  languageCode,
  languagePrompt,
  languageToRequest,
  languageToRetry,
} from "./stt/languages";
import { fullerTranscript } from "./stt/coverage";
import type { TimestampedTranscript, Transcript } from "./stt/types";

/** How long the Whisper check may take before the gpt-4o-transcribe text goes out alone (it took up to 7.8 s). */
const COVERAGE_TIMEOUT_MS = 8_000;

export class STTService {
  private openai: OpenAI;
  private model: string;
  private timestampModel: string;
  private coverageModel?: string;

  constructor() {
    const config = resolveSTTConfig();
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.timestampModel = config.timestampModel;
    this.coverageModel = config.coverageModel;
    logger.info(
      `Speech-to-text configured with ${config.provider} (${config.model})`,
    );
  }

  private async detectAudioType(audioBytes: Buffer): Promise<string | null> {
    try {
      const fileType = await fileTypeFromBuffer(audioBytes);
      if (fileType) {
        return fileType.ext;
      }

      // Fallback checks if file-type fails
      if (audioBytes.subarray(0, 4).toString("ascii") === "RIFF") {
        return "wav";
      } else if (audioBytes.subarray(0, 4).toString("ascii") === "OggS") {
        return "ogg";
      } else if (audioBytes.subarray(4, 8).toString("ascii") === "ftyp") {
        return "mp4";
      }

      return null;
    } catch (error) {
      logger.error("Error detecting audio type:", error);
      return null;
    }
  }

  private getMimeType(audioType: string): string {
    const mimeTypes: { [key: string]: string } = {
      webm: "audio/webm",
      ogg: "audio/ogg",
      mp4: "audio/mp4",
      wav: "audio/wav",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      flac: "audio/flac",
    };

    return mimeTypes[audioType] || `audio/${audioType}`;
  }

  // `spoken` is the person's languages (ISO 639-1, main one first); see stt/languages.ts.
  // `prompt` replaces the plain language prompt (voice logs prime the model with stt/voiceNotePrompt.ts).
  async transcribe(
    audioBytes: Buffer,
    receivedAudioFormat?: string,
    spoken: string[] = [],
    prompt?: string,
  ): Promise<Transcript> {
    assertAiConsent();
    try {
      const detectedAudioType = await this.detectAudioType(audioBytes);

      logger.info(
        `Received audio format: ${receivedAudioFormat || "not provided"}`,
      );
      logger.info(`Detected audio type: ${detectedAudioType || "unknown"}`);

      // Use the received format if valid, otherwise fall back to detected type
      const validFormats = ["webm", "ogg", "mp4", "wav", "mp3", "m4a", "flac"];
      const audioType =
        receivedAudioFormat && validFormats.includes(receivedAudioFormat)
          ? receivedAudioFormat
          : detectedAudioType;

      if (!audioType) {
        throw new Error("Unable to determine audio file type");
      }

      const mimeType = this.getMimeType(audioType);
      logger.info(`Using MIME type: ${mimeType}`);

      // Create a File-like object for OpenAI API
      const audioFile = new File([audioBytes], `audio.${audioType}`, {
        type: mimeType,
      });

      const check = this.checkCoverage(audioFile, spoken);
      let heard = await this.listen(audioFile, languageToRequest(spoken), spoken, prompt);
      const retry = languageToRetry(spoken, heard.language);
      if (retry) {
        logger.info(
          `Heard "${heard.language}", which this person doesn't speak. Transcribing again in "${retry}"`,
        );
        heard = await this.listen(audioFile, retry, spoken, prompt);
      }

      const checked = await check;
      if (checked) {
        const kept = fullerTranscript(heard.text, checked);
        if (kept.usedCheck) {
          logger.info("stt_coverage_used_whisper", {
            event: "stt_coverage_used_whisper",
            primary: heard.text.length,
            whisper: kept.text.length,
          });
          return { text: kept.text, language: heard.language, model: this.coverageModel! };
        }
      }

      logger.info(
        `Successfully transcribed ${heard.text.length} characters (language: ${heard.language || "unknown"})`,
      );
      return { ...heard, model: this.model };
    } catch (error) {
      logger.error("Error in speech-to-text:", error);
      throw new Error(`Speech-to-text failed: ${error}`);
    }
  }

  /**
   * Whisper's hearing of the same audio, to catch parts the main model dropped (stt/coverage.ts). Null when off,
   * slow, failed, or when Whisper heard a language the person doesn't speak (then its words can't be compared).
   */
  private async checkCoverage(audioFile: File, spoken: string[]): Promise<string | null> {
    if (!this.coverageModel) return null;
    const language = languageToRequest(spoken);
    const listening = this.openai.audio.transcriptions
      .create({
        file: audioFile,
        model: this.coverageModel,
        response_format: "verbose_json",
        ...(language ? { language } : {}),
      })
      .then((heard) => {
        const code = languageCode(heard.language);
        return spoken.length && code && !spoken.includes(code) ? null : heard.text;
      })
      .catch((error) => {
        logger.warn(`Whisper coverage check failed: ${error}`);
        return null;
      });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), COVERAGE_TIMEOUT_MS));
    return Promise.race([listening, timeout]);
  }

  // One request to the model. Whisper: verbose_json reports the language heard.
  // gpt-4o-transcribe: plain json, with the person's languages as a prompt.
  private async listen(
    audioFile: File,
    language: string | undefined,
    spoken: string[],
    givenPrompt?: string,
  ) {
    if (reportsLanguage(this.model)) {
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
        response_format: "verbose_json",
        ...(language ? { language } : {}),
      });
      return {
        text: transcription.text,
        language: language ?? languageCode(transcription.language),
      };
    }
    const prompt = givenPrompt ?? languagePrompt(spoken);
    // Temperature 0: on replays it was the steadiest (the same text 3 times out of 3 on notes that varied).
    const transcription = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: this.model,
      response_format: "json",
      temperature: 0,
      ...(language ? { language } : {}),
      ...(prompt ? { prompt } : {}),
    });
    return { text: transcription.text, language };
  }

  async speechToTextWithTimestamps(
    audioBytes: Buffer,
    receivedAudioFormat?: string,
  ): Promise<TimestampedTranscript> {
    assertAiConsent();
    try {
      const detectedAudioType = await this.detectAudioType(audioBytes);
      const validFormats = ["webm", "ogg", "mp4", "wav", "mp3", "m4a", "flac"];
      const audioType =
        receivedAudioFormat && validFormats.includes(receivedAudioFormat)
          ? receivedAudioFormat
          : detectedAudioType;

      if (!audioType) {
        throw new Error("Unable to determine audio file type");
      }

      const mimeType = this.getMimeType(audioType);
      const audioFile = new File([audioBytes], `audio.${audioType}`, {
        type: mimeType,
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: this.timestampModel,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      return {
        text: transcription.text,
        segments: transcription.segments?.map((segment) => ({
          start: segment.start,
          end: segment.end,
          text: segment.text,
        })),
      };
    } catch (error) {
      logger.error("Error in speech-to-text with timestamps:", error);
      throw new Error(`Speech-to-text with timestamps failed: ${error}`);
    }
  }
}

export const sttService = new STTService();

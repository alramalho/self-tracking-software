import OpenAI from "openai";
import { fileTypeFromBuffer } from "file-type";
import { assertAiConsent } from "../utils/aiConsent";
import { logger } from "../utils/logger";
import { resolveSTTConfig } from "./stt/config";
import type { TimestampedTranscript } from "./stt/types";

export class STTService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    const config = resolveSTTConfig();
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    logger.info(`Speech-to-text configured with ${config.provider}`);
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

  async speechToText(
    audioBytes: Buffer,
    receivedAudioFormat?: string,
  ): Promise<string> {
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

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
      });

      logger.info(
        `Successfully transcribed ${transcription.text.length} characters`,
      );
      return transcription.text;
    } catch (error) {
      logger.error("Error in speech-to-text:", error);
      throw new Error(`Speech-to-text failed: ${error}`);
    }
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
        model: this.model,
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

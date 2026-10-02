import OpenAI from "openai";
import { fileTypeFromBuffer } from "file-type";
import { assertAiConsent } from "../utils/aiConsent";
import { logger } from "../utils/logger";
import { resolveSTTConfig } from "./stt/config";
import {
  languageCode,
  languageToRequest,
  languageToRetry,
} from "./stt/languages";
import type { TimestampedTranscript, Transcript } from "./stt/types";

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
  async transcribe(
    audioBytes: Buffer,
    receivedAudioFormat?: string,
    spoken: string[] = [],
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

      let heard = await this.listen(audioFile, languageToRequest(spoken));
      const retry = languageToRetry(spoken, heard.language);
      if (retry) {
        logger.info(
          `Heard "${heard.language}", which this person doesn't speak. Transcribing again in "${retry}"`,
        );
        heard = await this.listen(audioFile, retry);
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

  // One request to the model. verbose_json is the format that reports the language heard.
  private async listen(audioFile: File, language?: string) {
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

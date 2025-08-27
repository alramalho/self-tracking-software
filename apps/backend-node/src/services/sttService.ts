import OpenAI from "openai";
import { fileTypeFromBuffer } from "file-type";
import { logger } from "../utils/logger";

export class STTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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
    receivedAudioFormat?: string
  ): Promise<string> {
    try {
      const detectedAudioType = await this.detectAudioType(audioBytes);

      logger.info(
        `Received audio format: ${receivedAudioFormat || "not provided"}`
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
        model: process.env.STT_MODEL || "whisper-1",
        language: "en", // Can be made configurable
      });

      logger.info(
        `Successfully transcribed audio: ${transcription.text.substring(0, 50)}...`
      );
      return transcription.text;
    } catch (error) {
      logger.error("Error in speech-to-text:", error);
      throw new Error(`Speech-to-text failed: ${error}`);
    }
  }

  async speechToTextWithTimestamps(
    audioBytes: Buffer,
    receivedAudioFormat?: string
  ): Promise<{
    text: string;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }> {
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
        model: process.env.STT_MODEL || "whisper-1",
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

import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import type { VoiceLogRecorderOptions } from "./types";

export const MAX_VOICE_LOG_DURATION_MS = 90_000;

export function useVoiceLogRecorder({
  onRecordingReady,
  onError,
}: VoiceLogRecorderOptions) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const stop = useCallback(async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await recorder.stop();
      const uri = recorder.uri ?? recorder.getStatus().url;
      if (!uri) {
        throw new Error("The recording couldn’t be saved. Please try again.");
      }
      await setAudioModeAsync({ allowsRecording: false });
      onRecordingReady(uri);
    } catch (error) {
      onError(error);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      setIsStopping(false);
    }
  }, [isStopping, onError, onRecordingReady, recorder, recorderState.isRecording]);

  useEffect(() => {
    if (
      recorderState.isRecording &&
      recorderState.durationMillis >= MAX_VOICE_LOG_DURATION_MS
    ) {
      void stop();
    }
  }, [recorderState.durationMillis, recorderState.isRecording, stop]);

  useEffect(
    () => () => {
      void setAudioModeAsync({ allowsRecording: false });
    },
    [],
  );

  async function start() {
    setIsStarting(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          "Allow microphone access in Settings to log a voice note.",
        );
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      onError(error);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      setIsStarting(false);
    }
  }

  return {
    durationMillis: recorderState.durationMillis,
    isRecording: recorderState.isRecording,
    isWorking: isStarting || isStopping,
    start,
    stop,
  };
}

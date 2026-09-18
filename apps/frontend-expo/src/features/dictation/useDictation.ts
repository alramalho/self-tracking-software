import { useEffect, useState } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { transcribeRecording } from "./service";
import type { DictationButtonProps } from "./types";

export function useDictation({
  onBusyChange,
  onError,
  onTranscript,
}: DictationButtonProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [isStarting, setIsStarting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(
    () => () => {
      // Expo releases the shared recorder object as this hook unmounts. Reading
      // recorder.isRecording here can race that release and throw natively.
      // The parent keeps this screen mounted while recording, so only restore
      // the audio session in cleanup and let useAudioRecorder release itself.
      void setAudioModeAsync({ allowsRecording: false });
    },
    [],
  );

  async function start() {
    setIsStarting(true);
    onBusyChange?.(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          "Allow microphone access in Settings to dictate your answer.",
        );
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      onBusyChange?.(false);
      onError(error);
      await setAudioModeAsync({ allowsRecording: false });
    } finally {
      setIsStarting(false);
    }
  }

  async function stop() {
    setIsTranscribing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri ?? recorder.getStatus().url;
      if (!uri)
        throw new Error("The recording couldn’t be saved. Please try again.");
      onTranscript(await transcribeRecording(uri));
    } catch (error) {
      onError(error);
    } finally {
      setIsTranscribing(false);
      onBusyChange?.(false);
      await setAudioModeAsync({ allowsRecording: false });
    }
  }

  return {
    durationMillis: recorderState.durationMillis,
    isRecording: recorderState.isRecording,
    isWorking: isStarting || isTranscribing,
    toggle: recorderState.isRecording ? stop : start,
  };
}

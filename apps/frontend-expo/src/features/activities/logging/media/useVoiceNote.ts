import { useEffect, useRef } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import type { Photo } from "@/core/types";

export const maxVoiceNoteMillis = 3 * 60 * 1000;

// Records one voice note to attach to a log (AAC in .m4a, about 1 MB a minute).
export function useVoiceNote(onRecorded: (note: Photo) => void, onError: (error: unknown) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const stopping = useRef(false);

  useEffect(() => () => void setAudioModeAsync({ allowsRecording: false }), []);

  async function start() {
    try {
      if (!(await requestRecordingPermissionsAsync()).granted)
        throw new Error("Allow microphone access in Settings to record a voice note.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      onError(error);
      await setAudioModeAsync({ allowsRecording: false });
    }
  }

  async function finish(keep: boolean) {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const durationMs = recorder.getStatus().durationMillis;
      await recorder.stop();
      const uri = recorder.uri ?? recorder.getStatus().url;
      if (!keep) return;
      if (!uri) throw new Error("The voice note couldn’t be saved. Please try again.");
      onRecorded({ uri, name: `voice-note-${Date.now()}.m4a`, type: "audio/mp4", durationMs });
    } catch (error) {
      onError(error);
    } finally {
      stopping.current = false;
      await setAudioModeAsync({ allowsRecording: false });
    }
  }

  useEffect(() => {
    if (state.isRecording && state.durationMillis >= maxVoiceNoteMillis) void finish(true);
  });

  return {
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
    start,
    stop: () => finish(true),
    discard: () => finish(false),
  };
}

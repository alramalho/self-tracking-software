// /app/hooks/useSpeaker.ts

import { useState, useEffect, useCallback, useRef } from "react";

export const useSpeaker = () => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const audioQueue = useRef<ArrayBuffer[]>([]); // Initialize with an empty array
  const isPlaying = useRef<boolean>(false);
  const currentSource = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const newAudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    setAudioContext(newAudioContext);

    return () => {
      newAudioContext.close();
    };
  }, []);

  const playAudio = useCallback(
    async (arrayBuffer: ArrayBuffer) => {
      if (!audioContext) return;

      isPlaying.current = true;
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        currentSource.current = source;
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          isPlaying.current = false;
          currentSource.current = null;
          playNext();
        };
        source.start();
      } catch (error) {
        console.error("Error playing audio:", error);
        isPlaying.current = false;
        currentSource.current = null;
        playNext();
      }
    },
    [audioContext]
  );

  const stopAudio = useCallback(() => {
    if (currentSource.current) {
      currentSource.current.stop();
      currentSource.current = null;
    }
    isPlaying.current = false;
    audioQueue.current = [];
  }, []);

  const playNext = useCallback(() => {
    if (audioQueue.current.length > 0 && !isPlaying.current) {
      const nextAudio = audioQueue.current.shift();
      if (nextAudio) {
        playAudio(nextAudio);
      }
    }
  }, [playAudio]);

  const addToQueue = useCallback(
    (arrayBuffer: ArrayBuffer) => {
      audioQueue.current.push(arrayBuffer);
      playNext();
    },
    [playNext]
  );

  return { addToQueue, stopAudio };
};

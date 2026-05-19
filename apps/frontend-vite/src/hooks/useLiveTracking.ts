import { useApiWithAuth } from "@/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { type GeoPosition, useGeolocation } from "./useGeolocation";
import { useLocalStorage } from "./useLocalStorage";

interface StoredLocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  speed: number | null;
  timestamp: number;
}

interface LiveTrackingState {
  isTracking: boolean;
  activityId: string | null;
  startedAt: number | null; // epoch ms
  locationPoints: StoredLocationPoint[];
}

const EMPTY_STATE: LiveTrackingState = {
  isTracking: false,
  activityId: null,
  startedAt: null,
  locationPoints: [],
};

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeTotalDistance(points: StoredLocationPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total;
}

export function useLiveTracking() {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const geo = useGeolocation();

  const [persisted, setPersisted] = useLocalStorage<LiveTrackingState>(
    "LIVE_TRACKING_STATE",
    EMPTY_STATE
  );

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTracking = persisted.isTracking;
  const activityId = persisted.activityId;
  const startedAt = persisted.startedAt;
  const locationPoints = persisted.locationPoints;
  const distanceMeters = computeTotalDistance(locationPoints);

  const latestSpeed =
    locationPoints.length > 0
      ? locationPoints[locationPoints.length - 1].speed
      : null;

  // Timer effect
  useEffect(() => {
    if (isTracking && startedAt) {
      const updateElapsed = () => {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsedSeconds(0);
    }
  }, [isTracking, startedAt]);

  // Start geo watch when tracking is active
  useEffect(() => {
    if (!isTracking) return;

    geo.watchPosition((pos: GeoPosition) => {
      setPersisted((prev) => ({
        ...prev,
        locationPoints: [
          ...prev.locationPoints,
          {
            latitude: pos.latitude,
            longitude: pos.longitude,
            altitude: pos.altitude,
            accuracy: pos.accuracy,
            speed: pos.speed,
            timestamp: pos.timestamp,
          },
        ],
      }));
    });

    return () => {
      geo.clearWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking]);

  const startTracking = useCallback(
    async (actId: string): Promise<boolean> => {
      const granted = await geo.requestPermission();
      if (!granted) {
        toast.error("Location permission is required for live tracking.");
        return false;
      }

      setPersisted({
        isTracking: true,
        activityId: actId,
        startedAt: Date.now(),
        locationPoints: [],
      });
      return true;
    },
    [geo, setPersisted]
  );

  const stopTracking = useCallback(() => {
    geo.clearWatch();
    setPersisted((prev) => ({ ...prev, isTracking: false }));
  }, [geo, setPersisted]);

  const discardTracking = useCallback(() => {
    geo.clearWatch();
    setPersisted(EMPTY_STATE);
  }, [geo, setPersisted]);

  const submitTracking = useCallback(
    async (quantity: number, description?: string) => {
      if (!persisted.activityId || !persisted.startedAt) return;

      setIsSubmitting(true);
      try {
        const endedAt = persisted.isTracking ? Date.now() : Date.now();

        await api.post("/activities/complete-live-activity", {
          activityId: persisted.activityId,
          startedAt: new Date(persisted.startedAt).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          quantity,
          description,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locationPoints: persisted.locationPoints.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude,
            accuracy: p.accuracy,
            speed: p.speed,
            timestamp: new Date(p.timestamp).toISOString(),
          })),
        });

        setPersisted(EMPTY_STATE);

        queryClient.invalidateQueries({ queryKey: ["activity-entries"] });
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
        queryClient.invalidateQueries({ queryKey: ["plans"] });
        queryClient.refetchQueries({ queryKey: ["current-user"] });

        toast.success("Live activity logged!");
      } catch (err) {
        console.error("Failed to submit live activity", err);
        toast.error("Failed to save activity. Your data is still saved locally.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, persisted, setPersisted, queryClient]
  );

  return {
    isTracking,
    activityId,
    startedAt,
    elapsedSeconds,
    locationPoints,
    distanceMeters,
    currentSpeed: latestSpeed,
    isSubmitting,
    startTracking,
    stopTracking,
    discardTracking,
    submitTracking,
    hasStaleSession: !persisted.isTracking && persisted.startedAt !== null,
  };
}

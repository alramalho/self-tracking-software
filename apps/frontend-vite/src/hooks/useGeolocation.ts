import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useCallback, useRef, useState } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  speed: number | null;
  timestamp: number;
}

export function useGeolocation() {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const watchIdRef = useRef<string | number | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await Geolocation.checkPermissions();
        if (status.location === "granted") {
          setIsPermissionGranted(true);
          return true;
        }
        const result = await Geolocation.requestPermissions();
        const granted = result.location === "granted";
        setIsPermissionGranted(granted);
        return granted;
      } else {
        const result = await navigator.permissions.query({
          name: "geolocation",
        });
        if (result.state === "granted") {
          setIsPermissionGranted(true);
          return true;
        }
        // Trigger browser prompt by requesting a position
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setIsPermissionGranted(true);
              resolve(true);
            },
            () => {
              setIsPermissionGranted(false);
              resolve(false);
            }
          );
        });
      }
    } catch {
      setIsPermissionGranted(false);
      return false;
    }
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<GeoPosition | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
      } else {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed,
                timestamp: pos.timestamp,
              });
            },
            () => resolve(null),
            { enableHighAccuracy: true }
          );
        });
      }
    } catch {
      return null;
    }
  }, []);

  const watchPosition = useCallback(
    (onPosition: (pos: GeoPosition) => void): void => {
      if (Capacitor.isNativePlatform()) {
        Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (pos, err) => {
            if (err || !pos) return;
            onPosition({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            });
          }
        ).then((id) => {
          watchIdRef.current = id;
        });
      } else {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            onPosition({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            });
          },
          undefined,
          { enableHighAccuracy: true }
        );
        watchIdRef.current = id;
      }
    },
    []
  );

  const clearWatch = useCallback(() => {
    if (watchIdRef.current === null) return;
    if (Capacitor.isNativePlatform()) {
      Geolocation.clearWatch({ id: watchIdRef.current as string });
    } else {
      navigator.geolocation.clearWatch(watchIdRef.current as number);
    }
    watchIdRef.current = null;
  }, []);

  return {
    isPermissionGranted,
    requestPermission,
    getCurrentPosition,
    watchPosition,
    clearWatch,
  };
}

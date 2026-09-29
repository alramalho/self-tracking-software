import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { ApproxLocation, Coordinates } from "./types";

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

async function currentCoordinates(): Promise<Coordinates | null> {
  if (Capacitor.isNativePlatform()) {
    const permission = await Geolocation.requestPermissions();
    if (permission.location !== "granted" && permission.coarseLocation !== "granted") return null;
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false });
    return position.coords;
  }
  if (!navigator.geolocation) return null;
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 1000 * 60 * 60, timeout: 15000 }
    )
  );
}

// Asks once for location, then keeps only a rough point (about 10 km).
// The server rounds it again; other people only ever see "same city".
export async function approximateLocation(): Promise<ApproxLocation | null> {
  const coords = await currentCoordinates();
  if (!coords) return null;
  return {
    latitude: roundToTenth(coords.latitude),
    longitude: roundToTenth(coords.longitude),
  };
}

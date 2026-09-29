import * as Location from "expo-location";
import type { PendingMatch } from "./types";

// Asks once for location, then keeps only a rough point and the city name.
// The server rounds it again; other people only ever see "same city".
export async function approximateLocation(): Promise<PendingMatch["location"] | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position =
    (await Location.getLastKnownPositionAsync()) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
  if (!position) return null;
  const latitude = Math.round(position.coords.latitude * 10) / 10;
  const longitude = Math.round(position.coords.longitude * 10) / 10;
  const [address] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  return { latitude, longitude, place: address?.city ?? address?.subregion ?? address?.region ?? undefined };
}

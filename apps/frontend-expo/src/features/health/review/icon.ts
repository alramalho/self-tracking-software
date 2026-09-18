import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  Waves,
} from "lucide-react-native";

export function workoutIcon(type: string) {
  const name = type.toLowerCase();
  if (/running|walking|hiking/.test(name)) return Footprints;
  if (/cycling|biking/.test(name)) return Bike;
  if (/swimming|water/.test(name)) return Waves;
  if (/strength|weight|functional/.test(name)) return Dumbbell;
  return Activity;
}

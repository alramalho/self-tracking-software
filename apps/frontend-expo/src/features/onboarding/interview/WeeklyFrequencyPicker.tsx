import { NumberPicker } from "./NumberPicker";
import type { WeeklyFrequencyPickerProps } from "./types";

export function WeeklyFrequencyPicker(props: WeeklyFrequencyPickerProps) {
  return <NumberPicker {...props} min={1} max={7} unit="sessions per week" decreaseLabel="Decrease sessions per week" increaseLabel="Increase sessions per week" valueLabel={`${props.value} sessions per week`} testID="onboarding-frequency" valueTestID="onboarding-weekly-frequency-value" />;
}

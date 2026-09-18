import { Field } from "./ui";
import type { DateFieldProps } from "./types";
export function DateField({
  label,
  value,
  onChange,
  includeTime = true,
}: DateFieldProps) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder={includeTime ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"}
    />
  );
}

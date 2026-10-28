export interface SearchFieldProps {
  testID: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
}

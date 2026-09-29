export interface SearchPerson { userId: string; username: string; name?: string | null; picture?: string | null }
export type SearchTab = "people" | "circles";
export interface SearchTabsProps {
  value: SearchTab;
  onChange: (tab: SearchTab) => void;
}
export interface SearchFieldProps {
  testID: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
}

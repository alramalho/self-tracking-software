export type SearchTab = "people" | "circles";

export interface SearchPageSearch {
  tab?: "circles";
}

export interface SearchTabsProps {
  value: SearchTab;
  onChange: (tab: SearchTab) => void;
}

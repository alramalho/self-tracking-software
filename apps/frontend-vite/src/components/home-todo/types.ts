export interface HomeTodoProps {
  onOpenMetricsLog: () => void;
}

export interface HomeTodoRow {
  id: string;
  icon: string;
  title: string;
  value: string;
  /** Needs the person's attention: accent dot and value. */
  attention?: boolean;
  onClick: () => void;
}

export interface HomeTodoRowsProps {
  rows: HomeTodoRow[];
}

export interface Emotion {
  name: string;
  score: number;
  color: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

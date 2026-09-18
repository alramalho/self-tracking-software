export type TelegramChannel = "activity" | "alerts";

export interface TelegramDeliveryReport {
  channel: TelegramChannel;
  configured: boolean;
  attempted: number;
  delivered: number;
  failed: number;
}

export interface TelegramDestinationCheck {
  maskedChatId: string;
  ok: boolean;
  type?: string;
  title?: string;
  error?: string;
}

export interface TelegramConnectionReport {
  channel: TelegramChannel;
  dedicated: boolean;
  botConfigured: boolean;
  botOk: boolean;
  botUsername?: string;
  destinations: TelegramDestinationCheck[];
}

export interface TelegramErrorNotificationData {
  errorMessage: string;
  userUsername?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: string;
}

import { TelegramService } from "../src/services/telegramService";

async function main() {
  const message = process.argv[2];

  if (!message) {
    console.error("Usage: tsx send_telegram_message.ts \"Your message\"");
    process.exit(1);
  }

  const telegramService = new TelegramService();
  await telegramService.sendMessage(message);
  console.log("Telegram message sent successfully");
}

main().catch((error) => {
  console.error("Failed to send Telegram message:", error);
  process.exit(1);
});

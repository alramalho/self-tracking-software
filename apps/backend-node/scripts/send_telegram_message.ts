import { TelegramService } from "../src/services/telegramService";

async function main() {
  const args = process.argv.slice(2);
  const sendAsAlert = args.includes("--alert");
  const message = args
    .filter((arg) => arg !== "--alert")
    .join(" ")
    .trim();

  if (!message) {
    console.error(
      'Usage: tsx send_telegram_message.ts [--alert] "Your message"',
    );
    process.exit(1);
  }

  const telegramService = new TelegramService();
  const report = sendAsAlert
    ? await telegramService.sendAlert(message)
    : await telegramService.sendMessage(message);

  if (!report.configured || report.delivered === 0 || report.failed > 0) {
    throw new Error(
      `Telegram ${report.channel} delivery failed (${report.delivered}/${report.attempted} destinations)`,
    );
  }

  console.log(
    `Telegram ${report.channel} message delivered to ${report.delivered} destination(s)`,
  );
}

main().catch((error) => {
  console.error("Failed to send Telegram message:", error);
  process.exit(1);
});

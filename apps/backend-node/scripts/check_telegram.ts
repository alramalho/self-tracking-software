import { TelegramService } from "../src/services/telegramService";
import type { TelegramChannel } from "../src/services/telegram/types";

const channels: TelegramChannel[] = ["activity", "alerts"];

async function main() {
  const telegram = new TelegramService();
  const reports = await Promise.all(
    channels.map((channel) => telegram.checkConnection(channel)),
  );

  for (const report of reports) {
    const destinationSummary = report.destinations
      .map((destination) => {
        const label = destination.title
          ? `${destination.title} (${destination.type})`
          : destination.maskedChatId;
        return `${label}: ${destination.ok ? "ok" : destination.error || "failed"}`;
      })
      .join(", ");

    console.log(
      [
        `${report.channel}:`,
        report.botOk ? `@${report.botUsername}` : "bot unavailable",
        destinationSummary || "no destinations",
        report.channel === "alerts" && !report.dedicated
          ? "(falling back to activity destinations)"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const failed = reports.some(
    (report) =>
      !report.botOk ||
      report.destinations.length === 0 ||
      report.destinations.some((destination) => !destination.ok),
  );
  const requiresDedicatedAlerts = process.argv.includes(
    "--require-dedicated-alerts",
  );
  const missingDedicatedAlerts =
    requiresDedicatedAlerts &&
    !reports.find((report) => report.channel === "alerts")?.dedicated;

  if (failed || missingDedicatedAlerts) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Telegram connection check failed:", error);
  process.exit(1);
});

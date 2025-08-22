import { NextResponse } from "next/server";

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode: string;
}

export async function POST(request: Request) {
  try {
    const { email, text } = await request.json();

    const message =
      `📝🐞 <b>New Initial Loading Bug Report</b>\n\n` +
      `<b>Environment:</b> ${process.env.NEXT_PUBLIC_ENVIRONMENT}\n` +
      `<b>Email:</b> <pre>${email}</pre>\n` +
      `<b>Message:</b>\n<pre>${text.slice(0, 500)}</pre>`; // Limit feedback length

    const telegramMessage: TelegramMessage = {
      chat_id: process.env.TELEGRAM_CHAT_ID!,
      text: message,
      parse_mode: "HTML",
    };

    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(telegramMessage),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to send Telegram message");
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error sending bug report:", error);
    return NextResponse.json(
      { error: "Failed to send bug report" },
      { status: 500 }
    );
  }
}

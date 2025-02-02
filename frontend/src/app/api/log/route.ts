import { NextResponse } from "next/server";

const AXIOM_DATASET = process.env.AXIOM_DATASET;
const AXIOM_TOKEN = process.env.AXIOM_TOKEN;
const AXIOM_INGEST_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;

interface LogEvent {
  time: string;
  level: string;
  message: string;
  service: string;
  extra?: Record<string, any>;
}

export async function POST(request: Request) {
  if (!AXIOM_TOKEN || !AXIOM_DATASET) {
    return NextResponse.json(
      { error: "Axiom configuration missing" },
      { status: 500 }
    );
  }

  try {
    const event = await request.json();

    // Ensure all required fields are present
    const logEvent: LogEvent = {
      time: event.time || new Date().toISOString(),
      level: event.level || "info",
      message: event.message || "",
      service: event.service || "tracking-so-frontend",
      extra: event.extra,
    };

    const response = await fetch(AXIOM_INGEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([logEvent]),
    });

    if (!response.ok) {
      throw new Error(`Axiom responded with status ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending log to Axiom:", error);
    return NextResponse.json({ error: "Failed to send log" }, { status: 500 });
  }
}

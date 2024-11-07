import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planName = searchParams.get("planName");
    const inviterName = searchParams.get("inviterName");
    const emoji = searchParams.get("emoji");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "54px",
              flexDirection: "column",
              background: "white",
              borderRadius: "16px",
              border: "2px solid #e5e7eb",
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 10px 20px -6px rgba(0, 0, 0, 0.15)",
              width: "95%",
              height: "95%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                marginBottom: "32px",
                alignSelf: "flex-start",
              }}
            >
              <span
                style={{
                  fontSize: "240px",
                  marginRight: "64px",
                  alignSelf: "flex-start",
                }}
              >
                {emoji ?? "🎯"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              <span
                style={{
                  maxWidth: "750px",
                  overflow: "hidden",
                  fontSize: "75px",
                  fontWeight: 900,
                  color: "#111827",
                  wordBreak: "break-word",
                  lineHeight: "1.1",
                }}
              >
                {planName?.slice(0, 20)}
              </span>
              <span
                style={{
                  fontSize: "64px",
                  color: "#898F9C",
                  wordBreak: "break-word",
                  maxWidth: "750px",
                }}
                >
                  You&apos;re invited by {inviterName} Braganca
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error.message);
    }
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}

import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planName = searchParams.get("planName");
    const inviterName = searchParams.get("inviterName");
    const emoji = searchParams.get("emoji");
    const sessionsPerWeekCount = searchParams.get("sessionsPerWeekCount");

    const interBold = await fetch(
      new URL("../../../../../public/fonts/Inter-Bold.ttf", import.meta.url)
    ).then((res) => res.arrayBuffer());

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, #FFFFFF 0%, #CACACA 100%)",
            fontFamily: 'system-ui',
            fontWeight: 400,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              marginBottom: "32px",
              alignSelf: "center",
            }}
          >
            <span
              style={{
                fontSize: "240px",
                marginRight: "64px",
                alignSelf: "center",
              }}
            >
              {emoji ?? "🎯"}
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "32px",
              }}
            >
              <span
                style={{
                  fontSize: "64px",
                  color: "#A5A9B4",
                  wordBreak: "break-word",
                  maxWidth: "750px",
                  lineHeight: "1.1",
                  fontFamily: 'system-ui',
                }}
              >
                Join {inviterName}&apos;s plan
              </span>
              <span
                style={{
                  maxWidth: "750px",
                  overflow: "hidden",
                  fontSize: "92px",
                  fontWeight: 700,
                  color: "#111827",
                  wordBreak: "break-word",
                  lineHeight: "1.1",
                  margin: "0px 0px 16px 0px",
                  fontFamily: '"Inter"',
                  minWidth: "700px",
                }}
              >
                {planName ? planName.slice(0, 25) + (planName.length > 25 ? "..." : "") : ""}
              </span>
              {sessionsPerWeekCount && parseInt(sessionsPerWeekCount) > 0 && (
                <span
                  style={{
                  fontSize: "48px",
                  color: "#898F9C",
                  wordBreak: "break-word",
                  maxWidth: "750px",
                }}
              >
                📌 {sessionsPerWeekCount} times per week
              </span>
            )}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter",
            data: interBold,
            weight: 700,
          },
        ],
      }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error.message);
    }
    return new ImageResponse(<div>Failed to generate the image</div>, {
      width: 1200,
      height: 630,
    });
  }
}

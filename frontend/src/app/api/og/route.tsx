import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planName = searchParams.get("planName");
    const inviterName = searchParams.get("inviterName");
    const emoji = searchParams.get("emoji");

    const interRegular = await fetch(
      new URL("../../../../public/fonts/Inter-Regular.ttf", import.meta.url)
    ).then((res) => res.arrayBuffer());

    const interBold = await fetch(
      new URL("../../../../public/fonts/Inter-Bold.ttf", import.meta.url)
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
            border: "2px solid #e5e7eb",
            background: "white",
            borderRadius: "16px",
            fontFamily: '"Inter"',
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "54px",
              flexDirection: "column",
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
                    color: "#898F9C",
                    wordBreak: "break-word",
                    maxWidth: "750px",
                    lineHeight: "1.1",
                  }}
                >
                  Join me in my plan
                </span>
                <span
                  style={{
                    maxWidth: "750px",
                    overflow: "hidden",
                    fontSize: "75px",
                    fontWeight: 700,
                    color: "#111827",
                    wordBreak: "break-word",
                    lineHeight: "1.1",
                    margin: "0px 0px 16px 0px",
                  }}
                >
                  {planName}
                </span>
                <span
                  style={{
                    fontSize: "48px",
                    color: "#898F9C",
                    wordBreak: "break-word",
                    maxWidth: "750px",
                  }}
                >
                  By {inviterName}
                </span>
              </div>
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
            data: interRegular,
            weight: 400,
          },
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

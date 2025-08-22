import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface Plan {
  emoji: string;
  goal: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const username = searchParams.get("username");
    const picture = searchParams.get("picture");
    const planCount = searchParams.get("planCount");
    const friendCount = searchParams.get("friendCount");
    const currentlyWorkingOnEmoji = searchParams.get("currentlyWorkingOnEmoji");
    const currentlyWorkingOnGoal = searchParams.get("currentlyWorkingOnGoal");

    const interBold = await fetch(
      new URL("../../../../../public/fonts/Inter-Bold.ttf", import.meta.url)
    ).then((res) => res.arrayBuffer());

    const bgImage = await fetch(
      new URL("../../../../../public/images/og-image-join.png", import.meta.url)
    ).then((res) => res.arrayBuffer());

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            backgroundImage: `url(data:image/png;base64,${Buffer.from(
              bgImage
            ).toString("base64")})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            fontFamily: "Inter",
            paddingLeft: "64px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "48px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "32px",
                marginBottom: "32px",
              }}
            >
              {/* Profile Picture */}
              <div
                style={{
                  width: "160px",
                  height: "160px",
                  borderRadius: "80px",
                  border: "8px solid white",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f3f4f6",
                }}
              >
                {picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={picture}
                    alt={name || "Profile"}
                    width={150}
                    height={150}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: "80px",
                      color: "#9ca3af",
                    }}
                  >
                    {name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>

              {/* Name and Username */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontSize: "48px",
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: "8px",
                  }}
                >
                  {name}
                </span>
                <span
                  style={{
                    fontSize: "24px",
                    color: "#6b7280",
                  }}
                >
                  @{username}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: "64px",
                marginBottom: "48px",
                marginTop: "16px",
                alignItems: "flex-start",
                marginRight: "48px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "64px",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {planCount}
                </span>
                <span
                  style={{
                    fontSize: "28px",
                    color: "#6b7280",
                  }}
                >
                  Plans
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "64px",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {friendCount}
                </span>
                <span
                  style={{
                    fontSize: "28px",
                    color: "#6b7280",
                  }}
                >
                  Friends
                </span>
              </div>
            </div>
          </div>
          {/* Plans Preview */}
          {currentlyWorkingOnEmoji && currentlyWorkingOnGoal && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "16px",
                marginRight: "48px",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  color: "#6b7280",
                }}
              >
                Currently working on
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "24px",
                  background: "white",
                  padding: "16px 32px",
                  borderRadius: "20px",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "60px" }}>
                  {currentlyWorkingOnEmoji}
                </span>
                <span
                  style={{
                    fontSize: "44px",
                    color: "#111827",
                    maxWidth: "400px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentlyWorkingOnGoal}
                </span>
              </div>
            </div>
          )}
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

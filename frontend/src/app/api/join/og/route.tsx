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
    const plansData = searchParams.get("plans");
    
    const plans: Plan[] = plansData ? JSON.parse(decodeURIComponent(plansData)) : [];

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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, #FFFFFF 0%, #CACACA 100%)",
            fontFamily: "Inter",
          }}
        >
          {/* Profile Picture */}
          <div
            style={{
              width: "200px",
              height: "200px",
              borderRadius: "100px",
              border: "8px solid white",
              marginBottom: "32px",
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
              alignItems: "center",
              marginBottom: "48px",
            }}
          >
            <span
              style={{
                fontSize: "64px",
                fontWeight: 700,
                color: "#111827",
                marginBottom: "8px",
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontSize: "32px",
                color: "#6b7280",
              }}
            >
              @{username}
            </span>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: "48px",
              marginBottom: "32px",
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
                  fontSize: "48px",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {planCount}
              </span>
              <span
                style={{
                  fontSize: "24px",
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
                  fontSize: "48px",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {friendCount}
              </span>
              <span
                style={{
                  fontSize: "24px",
                  color: "#6b7280",
                }}
              >
                Friends
              </span>
            </div>
          </div>

          {/* Plans Preview */}
          {plans.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  color: "#6b7280",
                }}
              >
                Currently working on
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                }}
              >
                {plans.slice(0, 3).map((plan, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "white",
                      padding: "12px 24px",
                      borderRadius: "16px",
                    }}
                  >
                    <span style={{ fontSize: "32px" }}>{plan.emoji}</span>
                    <span
                      style={{
                        fontSize: "24px",
                        color: "#111827",
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {plan.goal}
                    </span>
                  </div>
                ))}
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
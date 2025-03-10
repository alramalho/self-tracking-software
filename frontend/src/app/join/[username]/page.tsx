import { Metadata, ResolvingMetadata } from "next";
import ClientPage from "./ClientPage";
import { redirect } from "next/navigation";

type Props = {
  params: { username: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const userData = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/get-user-profile/${params.username}`
    ).then((res) => {
      if (!res.ok) throw new Error("Failed to fetch user data. Error: " + res.statusText);
      return res.json();
    });

    const user = userData.user;
    if (!user) throw new Error("User not found");

    const title = `Join ${user.name} on tracking.so`;
    const description = `Connect with ${user.name} (@${user.username}) on tracking.so`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tracking.so";
    const ogImageUrl = new URL("/api/join/og", baseUrl);

    ogImageUrl.searchParams.append("name", user.name);
    ogImageUrl.searchParams.append("username", user.username);
    ogImageUrl.searchParams.append("picture", user.picture);
    ogImageUrl.searchParams.append("planCount", user.plan_ids.length.toString());
    ogImageUrl.searchParams.append("friendCount", user.friend_ids.length.toString());
    if (userData.plans && userData.plans.length > 0) {
      ogImageUrl.searchParams.append("currentlyWorkingOnEmoji", userData.plans[0]?.emoji);
      ogImageUrl.searchParams.append("currentlyWorkingOnGoal", userData.plans[0]?.goal);
    }

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `https://tracking.so/join/${params.username}`,
        images: [{
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: title,
        }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl.toString()],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Join tracking.so",
      description: "Connect with users on tracking.so",
    };
  }
}

export default function Page({ params }: Props) {
  console.log("[JoinPage] Rendering with params:", params);
  
  try {
    // Redirect to signup with referral info if not signed in
    const searchParams = new URLSearchParams();
    searchParams.append("redirect_url", `/join/${params.username}`);
    searchParams.append("referrer", params.username);
    
    return <ClientPage params={params} />;
  } catch (error) {
    console.error("[JoinPage] Error rendering page:", error);
    return <div>Error loading page. Please try again.</div>;
  }
} 
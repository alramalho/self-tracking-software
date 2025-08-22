import { Metadata, ResolvingMetadata } from "next";
import ProfilePage from "./ProfilePage";

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
      if (!res.ok) throw new Error("Failed to fetch user data");
      return res.json();
    });
    const user = userData.user;
    if (!user) throw new Error("User not found");

    const title = `${user.name}'s profile on tracking.so`;
    const description = `Check out ${user.name}'s (@${user.username}) profile on tracking.so`;

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
        url: `https://tracking.so/profile/${params.username}`,
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
      title: "Profile | tracking.so",
      description: "View user profile on tracking.so",
    };
  }
}

export default function Page({ params }: Props) {
  return <ProfilePage />;
}

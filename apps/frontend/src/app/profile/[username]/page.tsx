import { getUserFullDataByUserNameOrId } from "@/contexts/users/actions";
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
    
    const users = await getUserFullDataByUserNameOrId([{username: params.username}])
    if (!users || users.length === 0) throw new Error("User not found");
    const user = users[0];

    const title = `${user.name}'s profile on tracking.so`;
    const description = `Check out ${user.name}'s (@${user.username}) profile on tracking.so`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tracking.so";
    const ogImageUrl = new URL("/api/join/og", baseUrl);
    if (user.name) {
      ogImageUrl.searchParams.append("name", user.name);
    }
    if (user.username) {  
      ogImageUrl.searchParams.append("username", user.username);
    }
    if (user.picture) {
      ogImageUrl.searchParams.append("picture", user.picture);
    }
    if (user.plans) {
      ogImageUrl.searchParams.append("planCount", user.plans.length.toString());
    }
    if (user.friends) {
      ogImageUrl.searchParams.append("friendCount", user.friends.length.toString());
    }    
    if (user.plans && user.plans.length > 0 && user.plans[0]?.goal) {
      ogImageUrl.searchParams.append("currentlyWorkingOnEmoji", user.plans[0]?.emoji || "🔥");
      ogImageUrl.searchParams.append("currentlyWorkingOnGoal", user.plans[0]?.goal);
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

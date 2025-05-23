import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { validateEnv } from "@/lib/env";
import { PHProvider } from "./providers";
import PostHogPageView from "./PostHogPageView";

const ClientLayout = dynamic(() => import("./layoutClient"), { ssr: false });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title:
    "Tracking.so – Improve your lifestyle",
  description:
    "Measure your progress and manage your habits. Gain insights, set goals, and achieve accountability with your friends and personal AI coach. All with our free and open source app",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.NODE_ENV !== "production") {
    validateEnv();
  }

  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=Geist:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </head>
      <PHProvider>
        <body className={inter.className}>
          <ClerkProvider>
            <PostHogPageView />
            <ClientLayout>{children}</ClientLayout>
          </ClerkProvider>
        </body>
      </PHProvider>
    </html>
  );
}

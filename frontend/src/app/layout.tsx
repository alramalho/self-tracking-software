import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { validateEnv } from "@/lib/env";
import { PHProvider } from "./providers";
import PostHogPageView from "./PostHogPageView";
import { Toaster } from "react-hot-toast"

const ClientLayout = dynamic(() => import("./layoutClient"), { ssr: false });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title:
    "Tracking Software APP - Your Free and Open Source App for Activity Tracking",
  description:
    "Measure your progress and manage your habits. Gain insights, set goals, and achieve accountability with your friends and personal AI coach.",
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

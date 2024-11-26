import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { validateEnv } from "@/lib/env";
import { PHProvider } from "./providers";
import PostHogPageView from "./PostHogPageView";

const ClientLayout = dynamic(() => import("./layoutClient"), { ssr: false });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tracking Software",
  description: "Know yourself better",
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
            <NotificationsProvider>
              <PostHogPageView />
              <ClientLayout>{children}</ClientLayout>
            </NotificationsProvider>
          </ClerkProvider>
        </body>
      </PHProvider>
    </html>
  );
}

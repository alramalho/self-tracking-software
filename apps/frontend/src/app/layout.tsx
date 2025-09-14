import { validateEnv } from "@/lib/env";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";
import "./globals.css";
import PostHogPageView from "./PostHogPageView";
import { PHProvider } from "./providers";

const ClientLayout = dynamic(() => import("./layoutClient"), { ssr: false });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "the self tracking app that gets you motivated | tracking.so ",
  description:
    "improve your consistency and improve your lifestyle. free and open source.",
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
          <script
            defer
            data-website-id="68c60ca54a6df1b68e91aa78"
            data-domain="tracking.so"
            src="https://datafa.st/js/script.js"
          ></script>
        </body>
      </PHProvider>
    </html>
  );
}

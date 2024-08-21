import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { ClerkProvider } from "@clerk/nextjs";
import dynamic from 'next/dynamic';

const ClientLayout = dynamic(() => import('./layoutClient'), { ssr: false });

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
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider>
          <NotificationsProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </NotificationsProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}